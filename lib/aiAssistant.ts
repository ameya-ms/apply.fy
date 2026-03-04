import Anthropic from '@anthropic-ai/sdk';
import type { ResumeData, UserProfile, Job } from '../types';
import { buildResumeContext } from './resumeParser';

// ─── Client Factory ──────────────────────────────────────────────────────────

let client: Anthropic | null = null;

export function initAI(apiKey: string): void {
  client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function getClient(): Anthropic {
  if (!client) throw new Error('AI not initialized. Call initAI(apiKey) first.');
  return client;
}

// ─── Application Questions ───────────────────────────────────────────────────

export async function answerApplicationQuestion(params: {
  question: string;
  job: Job;
  resume: ResumeData;
  profile: UserProfile;
  maxWords?: number;
}): Promise<string> {
  const { question, job, resume, profile, maxWords = 150 } = params;
  const resumeContext = buildResumeContext(resume);

  const systemPrompt = `You are a professional job application assistant helping ${profile.name} apply for jobs.
You write concise, authentic, first-person answers to job application questions.
Keep answers under ${maxWords} words unless the question specifically asks for more.
Write in a professional but genuine tone — avoid buzzwords and clichés.
Base answers strictly on the provided resume and profile data.

CANDIDATE PROFILE:
Name: ${profile.name}
Email: ${profile.email}
Years of Experience: ${profile.yearsExperience}
Skills: ${profile.skills.join(', ')}
LinkedIn: ${profile.linkedinUrl ?? 'N/A'}

${resumeContext}`;

  const userPrompt = `I am applying for: ${job.title} at ${job.company} (${job.location})

Job Description Summary:
${job.description.slice(0, 800)}

Application Question: "${question}"

Write my answer:`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  return block?.type === 'text' ? block.text.trim() : '';
}

// ─── Cover Letter ────────────────────────────────────────────────────────────

export async function generateCoverLetter(params: {
  job: Job;
  resume: ResumeData;
  profile: UserProfile;
  style?: 'formal' | 'casual' | 'startup';
}): Promise<string> {
  const { job, resume, profile, style = 'formal' } = params;
  const resumeContext = buildResumeContext(resume);

  const toneGuide = {
    formal: 'Professional and formal corporate tone',
    casual: 'Friendly, conversational, and approachable',
    startup: 'Energetic, innovative, and culture-fit focused',
  }[style];

  const prompt = `Write a concise cover letter (3 paragraphs, ~200 words) for this job application.

Tone: ${toneGuide}

CANDIDATE:
${resumeContext}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.slice(0, 600)}

Requirements:
- Opening: Show genuine interest in this specific company/role
- Middle: Highlight 2-3 most relevant experiences/skills from resume
- Closing: Clear call to action

Format as plain text, ready to copy-paste. Include placeholders [DATE] and [HIRING MANAGER] where appropriate.`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  return block?.type === 'text' ? block.text.trim() : '';
}

// ─── Job Match Score ─────────────────────────────────────────────────────────

export async function calculateMatchScore(params: {
  job: Job;
  resume: ResumeData;
  profile: UserProfile;
}): Promise<{ score: number; reasons: string[] }> {
  const { job, resume, profile } = params;
  const resumeContext = buildResumeContext(resume);

  const prompt = `Rate how well this candidate matches this job on a scale of 0-100.
Return ONLY valid JSON in this exact format: {"score": <number>, "reasons": ["reason1", "reason2", "reason3"]}

CANDIDATE SKILLS: ${resume.skills.join(', ')}
YEARS EXPERIENCE: ${profile.yearsExperience}
PREFERRED ROLES: ${profile.preferredRoles.join(', ')}

JOB: ${job.title} at ${job.company}
DESCRIPTION: ${job.description.slice(0, 400)}

Evaluate: skill match, experience level, role alignment. Be honest and concise.`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const block = response.content[0];
    const text = block?.type === 'text' ? block.text : '{}';
    const parsed = JSON.parse(text);
    return {
      score: Math.max(0, Math.min(100, parsed.score ?? 50)),
      reasons: parsed.reasons ?? [],
    };
  } catch {
    return { score: 50, reasons: [] };
  }
}

// ─── Location Helpers ────────────────────────────────────────────────────────

const STATE_FULL_TO_ABBREV: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar',
  california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de',
  florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id',
  illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks',
  kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok',
  oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut',
  vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv',
  wisconsin: 'wi', wyoming: 'wy', 'district of columbia': 'dc',
};

const STATE_ABBREV_TO_FULL: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FULL_TO_ABBREV).map(([full, abbrev]) => [abbrev, full])
);

/** Returns true if the job location matches a user-preferred location by state. */
function locationMatchesPreference(jobLoc: string, userPref: string): boolean {
  const jl = jobLoc.toLowerCase();
  const up = userPref.toLowerCase().trim();

  // Direct substring match
  if (jl.includes(up) || up.includes(jl)) return true;

  // Remote keyword
  if (up === 'remote') return false; // handled by remote bonus

  // Resolve user pref to abbreviation
  const userAbbrev = STATE_FULL_TO_ABBREV[up] ?? (STATE_ABBREV_TO_FULL[up] ? up : undefined);
  // Resolve user pref to full name
  const userFull = STATE_ABBREV_TO_FULL[up] ?? (STATE_FULL_TO_ABBREV[up] ? up : undefined);

  if (userAbbrev) {
    // Match ", CA" or " CA" or "CA," patterns in job location
    const abbrevPattern = new RegExp(`(\\b|,\\s*)${userAbbrev}(\\b|,|$)`, 'i');
    if (abbrevPattern.test(jl)) return true;
  }
  if (userFull && jl.includes(userFull)) return true;

  return false;
}

// ─── Intern/Co-op Term Expansion ─────────────────────────────────────────────

const INTERN_SYNONYMS = ['intern', 'internship', 'co-op', 'coop', 'co/op'];

function roleMatchesJob(role: string, jobText: string, jobTitle: string): boolean {
  if (jobText.includes(role) || jobTitle.includes(role)) return true;

  // Expand intern/co-op synonyms
  const isInternRole = INTERN_SYNONYMS.some((t) => role.includes(t));
  if (isInternRole) {
    return INTERN_SYNONYMS.some((t) => jobText.includes(t) || jobTitle.includes(t));
  }
  return false;
}

// ─── Batch Match Scoring ──────────────────────────────────────────────────────

export async function batchScoreJobs(
  jobs: Job[],
  resume: ResumeData,
  profile: UserProfile
): Promise<Map<string, number>> {
  const scoreMap = new Map<string, number>();

  // Score with simple heuristic first (fast, no API call)
  for (const job of jobs) {
    scoreMap.set(job.id, heuristicScore(job, resume, profile));
  }

  return scoreMap;
}

function heuristicScore(job: Job, resume: ResumeData, profile: UserProfile): number {
  let score = 50;

  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const jobTitle = job.title.toLowerCase();
  const userSkills = resume.skills.map((s) => s.toLowerCase());
  const preferredRoles = profile.preferredRoles.map((r) => r.toLowerCase());
  const preferredLocations = profile.preferredLocations.map((l) => l.toLowerCase());

  // Role match (with co-op/intern synonym expansion)
  for (const role of preferredRoles) {
    if (roleMatchesJob(role, jobText, jobTitle)) {
      score += 15;
      break;
    }
  }

  // Skills match
  let skillMatches = 0;
  for (const skill of userSkills) {
    if (jobText.includes(skill)) skillMatches++;
  }
  score += Math.min(25, skillMatches * 5);

  // Location match (state-level aware)
  for (const loc of preferredLocations) {
    if (loc === 'remote' && job.remote === 'remote') {
      score += 10;
      break;
    }
    if (locationMatchesPreference(job.location, loc)) {
      score += 10;
      break;
    }
  }

  // Remote bonus
  if (profile.remotePreference === 'remote' && job.remote === 'remote') score += 5;
  if (profile.remotePreference === 'hybrid' && job.remote === 'hybrid') score += 5;

  return Math.max(0, Math.min(100, score));
}

// ─── PDF Resume Parser ────────────────────────────────────────────────────────

export async function parseResumeFromPDF(base64Pdf: string): Promise<ResumeData> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          } as unknown as Anthropic.MessageParam['content'][number],
          {
            type: 'text',
            text: `Extract all information from this resume PDF and return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "name": "",
  "email": "",
  "phone": "",
  "website": "",
  "linkedin": "",
  "summary": "",
  "experience": [{"company": "", "title": "", "startDate": "", "endDate": "", "location": "", "current": false, "bullets": []}],
  "education": [{"institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": ""}],
  "projects": [{"name": "", "description": "", "technologies": [], "link": "", "bullets": []}],
  "skills": []
}
Leave fields empty string if not found. Return ONLY the JSON.`,
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  const text = block?.type === 'text' ? block.text.trim() : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse resume data from PDF');
  return JSON.parse(jsonMatch[0]) as ResumeData;
}

// ─── Common Question Templates ────────────────────────────────────────────────

export const COMMON_QUESTIONS = [
  'Why do you want to work here?',
  'Describe a challenging project and how you overcame it.',
  'What are your greatest strengths?',
  'Where do you see yourself in 5 years?',
  'Why are you leaving your current role?',
  'Describe your experience with [technology].',
  'How do you handle tight deadlines?',
  'Tell me about a time you led a team.',
];
