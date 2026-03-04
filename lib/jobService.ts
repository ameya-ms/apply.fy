import axios from 'axios';
import type { Job, SearchPreferences } from '../types';
import { batchScoreJobs } from './aiAssistant';
import type { ResumeData, UserProfile } from '../types';

// ─── API Configs ─────────────────────────────────────────────────────────────

const JSEARCH_BASE = 'https://jsearch.p.rapidapi.com';
const MUSE_BASE = 'https://www.themuse.com/api/public';
const REMOTIVE_BASE = 'https://remotive.com/api';
const ARBEITNOW_BASE = 'https://arbeitnow.com/api/job-board-api';
const HIMALAYAS_BASE = 'https://himalayas.app/jobs/api';
const SIMPLIFY_INTERNSHIPS_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md';

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

  const sources: Promise<Job[]>[] = [
    // Free, no-key sources — always run
    fetchFromMuse({ preferences, apiKey: museApiKey, page }).catch(() => []),
    fetchFromArbeitnow({ preferences }).catch(() => []),
    fetchFromHimalayas({ preferences }).catch(() => []),
    fetchFromSimplifyJobs({ preferences }).catch(() => []),
  ];

  if (preferences.remotePreference === 'remote' || preferences.remotePreference === 'any') {
    sources.push(fetchFromRemotive({ preferences }).catch(() => []));
  }

  if (jsearchApiKey) {
    sources.push(fetchFromJSearch({ preferences, apiKey: jsearchApiKey, page }).catch(() => []));
  }

  const results = await Promise.allSettled(sources);
  const buckets: Job[][] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : []
  );

  // Interleave sources for variety instead of concatenating
  const interleaved = interleaveJobs(buckets);

  // Deduplicate by company+title
  const seen = new Set<string>();
  const unique = interleaved.filter((job) => {
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

// Round-robin interleave from multiple source buckets
function interleaveJobs(buckets: Job[][]): Job[] {
  const result: Job[] = [];
  const maxLen = Math.max(...buckets.map((b) => b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) result.push(bucket[i]);
    }
  }
  return result;
}

// ─── JSearch (RapidAPI) ───────────────────────────────────────────────────────

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
  const location = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ');
  let salary: string | undefined;
  if (item.job_min_salary && item.job_max_salary) {
    salary = `$${formatSalary(item.job_min_salary)} – $${formatSalary(item.job_max_salary)}`;
    if (item.job_salary_period === 'YEAR') salary += '/yr';
    else if (item.job_salary_period === 'HOUR') salary += '/hr';
  }
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
    jobType: normalizeEmploymentType(item.job_employment_type),
    remote: item.job_is_remote ? 'remote' : 'onsite',
    source: 'jsearch',
    status: 'unseen',
    tags: [normalizeEmploymentType(item.job_employment_type) ?? 'full-time', item.job_is_remote ? 'remote' : 'onsite'],
  };
}

// ─── The Muse API ─────────────────────────────────────────────────────────────

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
  // Cap at 8 to avoid Muse dominating the feed
  return data.results.slice(0, 8).map((item: MuseJob) => normalizeMuseJob(item));
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

// ─── Arbeitnow (Free, no auth) ────────────────────────────────────────────────
// Global job board with strong remote and tech coverage

async function fetchFromArbeitnow(params: {
  preferences: SearchPreferences;
}): Promise<Job[]> {
  const { preferences } = params;

  const { data } = await axios.get(ARBEITNOW_BASE, {
    timeout: 10000,
  });

  if (!data?.data) return [];

  const search = buildSearchQuery(preferences).toLowerCase();
  const remoteOnly = preferences.remotePreference === 'remote';

  return (data.data as ArbeitnowJob[])
    .filter((job) => {
      if (remoteOnly && !job.remote) return false;
      const text = `${job.title} ${job.tags?.join(' ')}`.toLowerCase();
      return text.includes(search) || search.split(' ').some((w) => text.includes(w));
    })
    .slice(0, 15)
    .map(normalizeArbeitnowJob);
}

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
  url: string;
}

function normalizeArbeitnowJob(item: ArbeitnowJob): Job {
  return {
    id: `arbeitnow-${item.slug}`,
    title: item.title,
    company: item.company_name,
    location: item.remote ? 'Remote' : (item.location || 'Europe'),
    description: item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    applyUrl: item.url,
    postedDate: new Date(item.created_at * 1000).toISOString(),
    jobType: normalizeEmploymentType(item.job_types[0]),
    remote: item.remote ? 'remote' : 'onsite',
    source: 'manual',
    status: 'unseen',
    tags: [...item.tags, ...(item.remote ? ['remote'] : [])],
  };
}

// ─── Himalayas (Free, remote-focused, global) ─────────────────────────────────

async function fetchFromHimalayas(params: {
  preferences: SearchPreferences;
}): Promise<Job[]> {
  const { preferences } = params;
  const search = buildSearchQuery(preferences);

  const { data } = await axios.get(HIMALAYAS_BASE, {
    params: { limit: 20, search },
    timeout: 10000,
  });

  if (!data?.jobs) return [];

  return (data.jobs as HimalayasJob[]).slice(0, 15).map(normalizeHimalayasJob);
}

interface HimalayasJob {
  id: string;
  title: string;
  company: { name: string; logoUrl?: string };
  locationRestrictions: string[];
  description: string;
  applicationLink: string;
  createdAt: string;
  jobType: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
}

function normalizeHimalayasJob(item: HimalayasJob): Job {
  const locations = item.locationRestrictions ?? [];
  const location = locations.length > 0 ? locations.join(', ') : 'Remote';
  let salary: string | undefined;
  if (item.salaryMin && item.salaryMax) {
    salary = `$${formatSalary(item.salaryMin)} – $${formatSalary(item.salaryMax)}/yr`;
  }
  return {
    id: `himalayas-${item.id}`,
    title: item.title,
    company: item.company?.name ?? 'Unknown',
    companyLogo: item.company?.logoUrl,
    location,
    salary,
    salaryMin: item.salaryMin,
    salaryMax: item.salaryMax,
    description: item.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '',
    applyUrl: item.applicationLink,
    postedDate: item.createdAt,
    jobType: normalizeEmploymentType(item.jobType),
    remote: 'remote',
    source: 'manual',
    status: 'unseen',
    tags: [...(item.skills ?? []).slice(0, 4), 'remote'],
  };
}

// ─── Remotive (Remote-only jobs) ──────────────────────────────────────────────

async function fetchFromRemotive(params: {
  preferences: SearchPreferences;
}): Promise<Job[]> {
  const { preferences } = params;
  const search = preferences.roles[0] ?? 'software engineer';

  const { data } = await axios.get(`${REMOTIVE_BASE}/remote-jobs`, {
    params: { search, limit: 15 },
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

// ─── SimplifyJobs Internships (GitHub markdown table, free) ──────────────────
// Source: https://github.com/SimplifyJobs/Summer2026-Internships
// Format: HTML table embedded in markdown with 5 columns:
//   Company | Role | Location | Application | Age
// Rows use <td> cells; continuation rows have ↳ as the company cell.
// Application cell has two <a> links: first = direct employer URL, second = Simplify.

async function fetchFromSimplifyJobs(params: {
  preferences: SearchPreferences;
}): Promise<Job[]> {
  const { data: raw } = await axios.get<string>(SIMPLIFY_INTERNSHIPS_URL, {
    timeout: 15000,
    responseType: 'text',
  });
  return parseSimplifyReadme(raw as string, params.preferences);
}

function parseSimplifyReadme(content: string, preferences: SearchPreferences): Job[] {
  const jobs: Job[] = [];
  let lastCompany = '';

  // Each table row
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(content)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract <td> cells (header rows use <th> and are automatically skipped)
    const cells: string[] = [];
    const cellRegex = /<td>([\s\S]*?)<\/td>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }
    if (cells.length < 4) continue;

    const [companyCell, roleCell, locationCell, applicationCell, ageCell = ''] = cells;

    // ── Company ──────────────────────────────────────────────────────────────
    // Continuation rows have just "↳" in the company cell
    const companyStripped = decodeEntities(stripTags(companyCell)).trim();
    let company: string;
    if (companyStripped === '↳' || companyStripped.startsWith('↳')) {
      company = lastCompany;
    } else {
      // Extract text from <strong><a href="...">Company Name</a></strong>
      const linkMatch = companyCell.match(/<a[^>]*>([^<]+)<\/a>/);
      company = linkMatch ? decodeEntities(linkMatch[1].trim()) : companyStripped;
      if (company) lastCompany = company;
    }
    if (!company) continue;

    // ── Role ──────────────────────────────────────────────────────────────────
    const role = decodeEntities(stripTags(roleCell)).trim();
    if (!role) continue;

    // ── Skip closed roles (🔒 means application closed) ───────────────────────
    if (applicationCell.includes('🔒')) continue;

    // ── Location ──────────────────────────────────────────────────────────────
    // Multiple locations are separated by <br> tags
    const locationRaw = locationCell.replace(/<br\s*\/?>/gi, ', ');
    const location = decodeEntities(stripTags(locationRaw))
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim() || 'USA';
    const isRemote = /remote/i.test(location);

    // ── Apply URL ─────────────────────────────────────────────────────────────
    // First <a href> is the direct employer link; second is the Simplify shortlink
    const applyMatch = applicationCell.match(/href="([^"]+)"/);
    if (!applyMatch) continue;
    const applyUrl = applyMatch[1];

    // ── Age (days since posted) ───────────────────────────────────────────────
    const postedDate = ageToDate(stripTags(ageCell).trim());

    // ── Stable deduplication ID ───────────────────────────────────────────────
    const rawId = `simplify-${company}-${role}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

    jobs.push({
      id: rawId,
      title: role,
      company,
      location,
      description:
        `${role} internship at ${company}.\n\nLocation: ${location}\n\n` +
        `This is a Summer 2026 internship listing from the SimplifyJobs GitHub board. ` +
        `Tap Apply to visit the employer's application page directly.`,
      applyUrl,
      postedDate,
      jobType: 'internship',
      remote: isRemote ? 'remote' : 'onsite',
      source: 'manual',
      status: 'unseen',
      tags: ['internship', 'summer-2026', ...(isRemote ? ['remote'] : [])],
    });
  }

  return filterSimplifyJobs(jobs, preferences);
}

function filterSimplifyJobs(jobs: Job[], preferences: SearchPreferences): Job[] {
  const remoteOnly = preferences.remotePreference === 'remote';

  const filtered = jobs.filter((job) => {
    if (remoteOnly && job.remote !== 'remote') return false;

    // If role preferences are set, require at least one keyword match.
    // Always pass through common SWE-adjacent titles even with no match.
    if (preferences.roles.length > 0) {
      const t = job.title.toLowerCase();
      const keywordMatch = preferences.roles.some((r) =>
        r.toLowerCase().split(/\s+/).some((w) => t.includes(w))
      );
      const isTech =
        /software|engineer|developer|data|ml|ai|swe|backend|frontend|full.?stack|devops|cloud|mobile|ios|android|security|research|quant/i.test(
          job.title
        );
      if (!keywordMatch && !isTech) return false;
    }

    return true;
  });

  // Cap at 20 to avoid the internship list dominating the feed
  return filtered.slice(0, 20);
}

// Strip HTML tags (leaves text content)
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// Decode common HTML entities
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#43;/g, '+');
}

// Convert age string like "5d" or "30d+" to an ISO date
function ageToDate(ageText: string): string {
  const m = ageText.match(/(\d+)/);
  if (!m) return new Date().toISOString();
  const days = parseInt(m[1], 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Demo/Mock Jobs ───────────────────────────────────────────────────────────

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
      description: `Stripe is looking for a Senior Software Engineer to join our payments infrastructure team. You'll work on the systems that process billions of dollars in payments annually.\n\nYou'll design and build distributed systems, mentor junior engineers, and collaborate with product teams to deliver features that impact millions of businesses worldwide.`,
      requirements: ['5+ years of software engineering experience', 'Strong proficiency in Go, Ruby, or Java', 'Experience with distributed systems'],
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
      description: `Linear is building the future of software project management. We're looking for a Frontend Engineer passionate about craft, performance, and beautiful interfaces.\n\nYou'll work on our React/TypeScript codebase, building features used by thousands of engineering teams every day.`,
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
      description: `Notion is an all-in-one workspace used by millions. We're looking for an iOS Engineer to own and evolve our mobile application.\n\nYou'll work closely with design and product to ship polished, performant iOS experiences.`,
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
      description: `Figma is the leading design platform. We're looking for a Backend Engineer to join our Platform team, building the infrastructure that powers real-time collaboration for millions of users.`,
      applyUrl: 'https://figma.com/careers',
      postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      jobType: 'full-time',
      remote: 'hybrid',
      source: 'manual',
      status: 'unseen',
      matchScore: 84,
      tags: ['Rust', 'Go', 'PostgreSQL'],
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSearchQuery(preferences: SearchPreferences): string {
  if (preferences.roles.length > 0) return preferences.roles[0];
  return 'software engineer';
}

function normalizeEmploymentType(type: string | null | undefined): Job['jobType'] {
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
