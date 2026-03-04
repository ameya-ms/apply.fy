import axios from 'axios';
import type { Job, SearchPreferences } from '../types';
import { batchScoreJobs } from './aiAssistant';
import type { ResumeData, UserProfile } from '../types';

// ─── API Configs ─────────────────────────────────────────────────────────────

const JSEARCH_BASE = 'https://jsearch.p.rapidapi.com';
const MUSE_BASE = 'https://www.themuse.com/api/public';
const REMOTIVE_BASE = 'https://remotive.com/api';

// ─── Main Job Fetcher ─────────────────────────────────────────────────────────

export interface FetchJobsOptions {
  preferences: SearchPreferences;
  jsearchApiKey?: string;
  museApiKey?: string;
  resume?: ResumeData;
  profile?: UserProfile;
  page?: number;
}

export async function fetchJobs(options: FetchJobsOptions): Promise<Job[]> {
  const { preferences, jsearchApiKey, museApiKey, resume, profile, page = 1 } = options;

  const allJobs: Job[] = [];
  const errors: string[] = [];

  // Fetch from multiple sources in parallel
  const sources: Promise<Job[]>[] = [];

  if (jsearchApiKey) {
    sources.push(fetchFromJSearch({ preferences, apiKey: jsearchApiKey, page }).catch((e) => {
      errors.push(`JSearch: ${e.message}`);
      return [];
    }));
  }

  sources.push(
    fetchFromMuse({ preferences, apiKey: museApiKey, page }).catch((e) => {
      errors.push(`Muse: ${e.message}`);
      return [];
    })
  );

  if (preferences.remotePreference === 'remote' || preferences.remotePreference === 'any') {
    sources.push(
      fetchFromRemotive({ preferences }).catch((e) => {
        errors.push(`Remotive: ${e.message}`);
        return [];
      })
    );
  }

  const results = await Promise.allSettled(sources);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = allJobs.filter((job) => {
    const key = `${job.company}-${job.title}`.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score jobs if we have resume data
  if (resume && profile) {
    const scores = await batchScoreJobs(unique, resume, profile);
    for (const job of unique) {
      job.matchScore = scores.get(job.id) ?? 50;
    }
    unique.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }

  return unique;
}

// ─── JSearch (RapidAPI) ───────────────────────────────────────────────────────
// Aggregates Indeed, LinkedIn, Glassdoor, and more

async function fetchFromJSearch(params: {
  preferences: SearchPreferences;
  apiKey: string;
  page?: number;
}): Promise<Job[]> {
  const { preferences, apiKey, page = 1 } = params;

  const query = buildSearchQuery(preferences);
  const location = preferences.locations[0] ?? 'United States';

  const { data } = await axios.get(`${JSEARCH_BASE}/search`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    params: {
      query: `${query} in ${location}`,
      page: String(page),
      num_pages: '1',
      date_posted: 'week',
      remote_jobs_only: preferences.remotePreference === 'remote' ? 'true' : 'false',
    },
    timeout: 10000,
  });

  if (!data?.data) return [];

  return data.data.map((item: JSearchJob) => normalizeJSearchJob(item));
}

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo: string | null;
  job_city: string;
  job_state: string;
  job_country: string;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_salary_period: string | null;
  job_description: string;
  job_highlights: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  } | null;
  job_apply_link: string;
  job_posted_at_datetime_utc: string | null;
  job_employment_type: string | null;
  job_is_remote: boolean;
}

function normalizeJSearchJob(item: JSearchJob): Job {
  const location = [item.job_city, item.job_state, item.job_country]
    .filter(Boolean)
    .join(', ');

  let salary: string | undefined;
  if (item.job_min_salary && item.job_max_salary) {
    salary = `$${formatSalary(item.job_min_salary)} – $${formatSalary(item.job_max_salary)}`;
    if (item.job_salary_period === 'YEAR') salary += '/yr';
    else if (item.job_salary_period === 'HOUR') salary += '/hr';
  }

  const jobType = normalizeEmploymentType(item.job_employment_type);

  return {
    id: `jsearch-${item.job_id}`,
    title: item.job_title,
    company: item.employer_name,
    companyLogo: item.employer_logo ?? undefined,
    location: location || 'Remote',
    salary,
    salaryMin: item.job_min_salary ?? undefined,
    salaryMax: item.job_max_salary ?? undefined,
    description: item.job_description,
    requirements: item.job_highlights?.Qualifications,
    responsibilities: item.job_highlights?.Responsibilities,
    benefits: item.job_highlights?.Benefits,
    applyUrl: item.job_apply_link,
    postedDate: item.job_posted_at_datetime_utc ?? undefined,
    jobType,
    remote: item.job_is_remote ? 'remote' : 'onsite',
    source: 'jsearch',
    status: 'unseen',
    tags: [jobType ?? 'full-time', item.job_is_remote ? 'remote' : 'onsite'].filter(
      Boolean
    ) as string[],
  };
}

// ─── The Muse API ─────────────────────────────────────────────────────────────
// Free tier: 5000 req/month, no auth needed

async function fetchFromMuse(params: {
  preferences: SearchPreferences;
  apiKey?: string;
  page?: number;
}): Promise<Job[]> {
  const { preferences, apiKey, page = 1 } = params;

  const category = preferences.roles[0] ?? 'Software Engineer';

  const queryParams: Record<string, string> = {
    category,
    page: String(page - 1),
    descending: 'true',
  };

  if (apiKey) queryParams.api_key = apiKey;
  if (preferences.locations[0]) queryParams.location = preferences.locations[0];

  const { data } = await axios.get(`${MUSE_BASE}/jobs`, {
    params: queryParams,
    timeout: 10000,
  });

  if (!data?.results) return [];

  return data.results.map((item: MuseJob) => normalizeMuseJob(item));
}

interface MuseJob {
  id: number;
  name: string;
  company: { name: string };
  locations: Array<{ name: string }>;
  levels: Array<{ name: string }>;
  categories: Array<{ name: string }>;
  contents: string;
  refs: { landing_page: string };
  publication_date: string;
}

function normalizeMuseJob(item: MuseJob): Job {
  const location = item.locations.map((l) => l.name).join(', ') || 'Flexible';
  const isRemote = location.toLowerCase().includes('remote') || location.includes('Flexible');
  // Strip HTML from contents
  const description = item.contents.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    id: `muse-${item.id}`,
    title: item.name,
    company: item.company.name,
    location,
    description,
    applyUrl: item.refs.landing_page,
    postedDate: item.publication_date,
    jobType: 'full-time',
    remote: isRemote ? 'remote' : 'onsite',
    source: 'muse',
    status: 'unseen',
    tags: item.categories.map((c) => c.name),
  };
}

// ─── Remotive (Remote-only jobs) ──────────────────────────────────────────────

async function fetchFromRemotive(params: {
  preferences: SearchPreferences;
}): Promise<Job[]> {
  const { preferences } = params;
  const search = preferences.roles[0] ?? 'software engineer';

  const { data } = await axios.get(`${REMOTIVE_BASE}/remote-jobs`, {
    params: { search, limit: 20 },
    timeout: 10000,
  });

  if (!data?.jobs) return [];

  return data.jobs.map((item: RemotiveJob) => normalizeRemotiveJob(item));
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

function normalizeRemotiveJob(item: RemotiveJob): Job {
  const description = item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    id: `remotive-${item.id}`,
    title: item.title,
    company: item.company_name,
    companyLogo: item.company_logo ?? undefined,
    location: item.candidate_required_location || 'Worldwide',
    salary: item.salary || undefined,
    description,
    applyUrl: item.url,
    postedDate: item.publication_date,
    jobType: normalizeEmploymentType(item.job_type),
    remote: 'remote',
    source: 'remotive',
    status: 'unseen',
    tags: [...item.tags, 'remote'],
  };
}

// ─── Demo/Mock Jobs ───────────────────────────────────────────────────────────
// Used when no API keys are configured

export function getMockJobs(): Job[] {
  return [
    {
      id: 'mock-1',
      title: 'Senior Software Engineer',
      company: 'Stripe',
      companyLogo: 'https://logo.clearbit.com/stripe.com',
      location: 'San Francisco, CA',
      salary: '$180,000 – $250,000/yr',
      salaryMin: 180000,
      salaryMax: 250000,
      description: `Stripe is looking for a Senior Software Engineer to join our payments infrastructure team. You'll work on the systems that process billions of dollars in payments annually, ensuring reliability, performance, and scalability.\n\nYou'll design and build distributed systems, mentor junior engineers, and collaborate with product teams to deliver features that impact millions of businesses worldwide.`,
      requirements: [
        '5+ years of software engineering experience',
        'Strong proficiency in Go, Ruby, or Java',
        'Experience with distributed systems',
        'Strong problem-solving skills',
      ],
      responsibilities: [
        'Design and implement scalable payment infrastructure',
        'Lead technical design for new features',
        'Mentor junior engineers',
        'Participate in on-call rotation',
      ],
      benefits: ['Health, dental, vision', 'Equity', '401k matching', 'Remote-friendly'],
      applyUrl: 'https://stripe.com/jobs',
      postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      jobType: 'full-time',
      remote: 'hybrid',
      source: 'manual',
      status: 'unseen',
      matchScore: 87,
      tags: ['Go', 'Distributed Systems', 'Payments'],
    },
    {
      id: 'mock-2',
      title: 'Frontend Engineer',
      company: 'Linear',
      companyLogo: 'https://logo.clearbit.com/linear.app',
      location: 'Remote',
      salary: '$150,000 – $200,000/yr',
      description: `Linear is building the future of software project management. We're looking for a Frontend Engineer who is passionate about craft, performance, and beautiful interfaces.\n\nYou'll work on our React/TypeScript codebase, building features used by thousands of engineering teams every day.`,
      requirements: [
        '3+ years React/TypeScript experience',
        'Eye for design and detail',
        'Experience with performance optimization',
      ],
      applyUrl: 'https://linear.app/jobs',
      postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      jobType: 'full-time',
      remote: 'remote',
      source: 'manual',
      status: 'unseen',
      matchScore: 82,
      tags: ['React', 'TypeScript', 'Remote'],
    },
    {
      id: 'mock-3',
      title: 'Full Stack Engineer',
      company: 'Vercel',
      companyLogo: 'https://logo.clearbit.com/vercel.com',
      location: 'Remote',
      salary: '$160,000 – $220,000/yr',
      description: `Vercel is the platform for frontend developers. We're hiring Full Stack Engineers to help build the infrastructure that powers millions of websites.\n\nYou'll work across our Next.js deployment pipeline, edge network, and developer tools.`,
      applyUrl: 'https://vercel.com/careers',
      postedDate: new Date().toISOString(),
      jobType: 'full-time',
      remote: 'remote',
      source: 'manual',
      status: 'unseen',
      matchScore: 91,
      tags: ['Next.js', 'Node.js', 'AWS', 'Remote'],
    },
    {
      id: 'mock-4',
      title: 'iOS Engineer',
      company: 'Notion',
      companyLogo: 'https://logo.clearbit.com/notion.so',
      location: 'New York, NY',
      salary: '$170,000 – $230,000/yr',
      description: `Notion is an all-in-one workspace used by millions. We're looking for an iOS Engineer to own and evolve our mobile application, which has millions of daily active users.\n\nYou'll work closely with design and product to ship polished, performant iOS experiences.`,
      applyUrl: 'https://notion.so/careers',
      postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      jobType: 'full-time',
      remote: 'hybrid',
      source: 'manual',
      status: 'unseen',
      matchScore: 78,
      tags: ['Swift', 'iOS', 'Mobile'],
    },
    {
      id: 'mock-5',
      title: 'Backend Engineer – Platform',
      company: 'Figma',
      companyLogo: 'https://logo.clearbit.com/figma.com',
      location: 'San Francisco, CA',
      salary: '$175,000 – $240,000/yr',
      description: `Figma is the leading design platform used by the world's best product teams. We're looking for a Backend Engineer to join our Platform team, building the infrastructure that powers real-time collaboration for millions of users.`,
      applyUrl: 'https://figma.com/careers',
      postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      jobType: 'full-time',
      remote: 'hybrid',
      source: 'manual',
      status: 'unseen',
      matchScore: 84,
      tags: ['Rust', 'Go', 'PostgreSQL', 'Real-time'],
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSearchQuery(preferences: SearchPreferences): string {
  if (preferences.roles.length > 0) return preferences.roles[0];
  return 'software engineer';
}

function normalizeEmploymentType(type: string | null): Job['jobType'] {
  if (!type) return 'full-time';
  const t = type.toLowerCase();
  if (t.includes('part')) return 'part-time';
  if (t.includes('contract') || t.includes('freelance')) return 'contract';
  if (t.includes('intern')) return 'internship';
  return 'full-time';
}

function formatSalary(amount: number): string {
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(Math.round(amount));
}
