import OpenAI from 'openai';
import type { ResumeData, UserProfile, Job } from '../types';
import { buildResumeContext } from './resumeParser';

// ─── Client Factory ──────────────────────────────────────────────────────────

let client: OpenAI | null = null;

export function initAI(apiKey: string): void {
  client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

function getClient(): OpenAI {
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

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 400,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? '';
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

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? '';
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

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
    return {
      score: Math.max(0, Math.min(100, parsed.score ?? 50)),
      reasons: parsed.reasons ?? [],
    };
  } catch {
    return { score: 50, reasons: [] };
  }
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
  const userSkills = resume.skills.map((s) => s.toLowerCase());
  const preferredRoles = profile.preferredRoles.map((r) => r.toLowerCase());
  const preferredLocations = profile.preferredLocations.map((l) => l.toLowerCase());

  // Role match
  for (const role of preferredRoles) {
    if (jobText.includes(role) || job.title.toLowerCase().includes(role)) {
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

  // Location match
  const jobLocation = job.location.toLowerCase();
  for (const loc of preferredLocations) {
    if (jobLocation.includes(loc) || loc.includes('remote') && job.remote === 'remote') {
      score += 10;
      break;
    }
  }

  // Remote bonus
  if (profile.remotePreference === 'remote' && job.remote === 'remote') score += 5;
  if (profile.remotePreference === 'hybrid' && job.remote === 'hybrid') score += 5;

  return Math.max(0, Math.min(100, score));
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
