import type { ResumeData, WorkExperience, Education, Project } from '../types';

// ─── LaTeX → JSON Parser ─────────────────────────────────────────────────────
// Regex-based parser that handles common LaTeX resume templates
// Supports: moderncv, Jake's resume, AltaCV, and plain \section{} templates

export function parseLatexResume(tex: string): ResumeData {
  // Strip comments and clean up
  const cleaned = tex
    .replace(/%.*$/gm, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return {
    name: extractName(cleaned),
    email: extractEmail(cleaned),
    phone: extractPhone(cleaned),
    website: extractWebsite(cleaned),
    linkedin: extractLinkedIn(cleaned),
    summary: extractSummary(cleaned),
    experience: extractExperience(cleaned),
    education: extractEducation(cleaned),
    projects: extractProjects(cleaned),
    skills: extractSkills(cleaned),
    rawText: texToPlainText(cleaned),
  };
}

// ─── Extractors ──────────────────────────────────────────────────────────────

function extractName(tex: string): string | undefined {
  // \name{First}{Last} or \name{Full Name} (moderncv)
  const moderncv = tex.match(/\\name\{([^}]+)\}\{([^}]*)\}/);
  if (moderncv) return `${moderncv[1]} ${moderncv[2]}`.trim();

  // \author{Name}
  const author = tex.match(/\\author\{([^}]+)\}/);
  if (author) return stripLatex(author[1]);

  // Jake's template: \textbf{\Huge Name} or first large text
  const huge = tex.match(/\\textbf\{\\Huge\s+([^}]+)\}/);
  if (huge) return stripLatex(huge[1]);

  return undefined;
}

function extractEmail(tex: string): string | undefined {
  const email = tex.match(/\\email\{([^}]+)\}|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return email ? (email[1] ?? email[2]) : undefined;
}

function extractPhone(tex: string): string | undefined {
  const patterns = [
    /\\phone\[mobile\]\{([^}]+)\}/,
    /\\phone\{([^}]+)\}/,
    /\\mobile\{([^}]+)\}/,
    /(\+?[\d\s\-().]{10,20})/,
  ];
  for (const pattern of patterns) {
    const match = tex.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

function extractWebsite(tex: string): string | undefined {
  const patterns = [
    /\\homepage\{([^}]+)\}/,
    /\\website\{([^}]+)\}/,
    /href\{(https?:\/\/(?!linkedin)[^}]+)\}/,
  ];
  for (const pattern of patterns) {
    const match = tex.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

function extractLinkedIn(tex: string): string | undefined {
  const match = tex.match(/linkedin\.com\/in\/([^\s}\\]+)/);
  if (match) return `https://linkedin.com/in/${match[1]}`;
  const social = tex.match(/\\linkedin\{([^}]+)\}/i);
  if (social) return social[1];
  return undefined;
}

function extractSummary(tex: string): string | undefined {
  const sectionContent = extractSection(tex, ['summary', 'objective', 'profile', 'about']);
  if (!sectionContent) return undefined;
  const text = texToPlainText(sectionContent).trim();
  return text.length > 10 ? text : undefined;
}

// ─── Experience ──────────────────────────────────────────────────────────────

function extractExperience(tex: string): WorkExperience[] {
  const section = extractSection(tex, [
    'experience',
    'work experience',
    'employment',
    'work history',
    'professional experience',
  ]);
  if (!section) return [];

  const experiences: WorkExperience[] = [];

  // Pattern 1: \cventry{dates}{title}{company}{location}{}{bullets}
  const cventryPattern =
    /\\cventry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{[^}]*\}\{([^}]*)\}/gs;
  let match;
  while ((match = cventryPattern.exec(section)) !== null) {
    const [, dates, title, company, location, content] = match;
    const { startDate, endDate } = parseDateRange(dates);
    experiences.push({
      company: stripLatex(company),
      title: stripLatex(title),
      startDate,
      endDate,
      location: stripLatex(location),
      bullets: extractBullets(content),
      current: endDate?.toLowerCase().includes('present') || endDate === undefined,
    });
  }

  if (experiences.length > 0) return experiences;

  // Pattern 2: Jake's template / custom \resumeSubheading
  const subheadingPattern =
    /\\resumeSubheading\s*\{([^}]*)\}\{([^}]*)\}\s*\{([^}]*)\}\{([^}]*)\}([\s\S]*?)(?=\\resumeSubheading|\\resumeProjectHeading|$)/g;
  while ((match = subheadingPattern.exec(section)) !== null) {
    const [, company, dates, title, location, content] = match;
    const { startDate, endDate } = parseDateRange(dates);
    experiences.push({
      company: stripLatex(company),
      title: stripLatex(title),
      startDate,
      endDate,
      location: stripLatex(location),
      bullets: extractBullets(content),
    });
  }

  if (experiences.length > 0) return experiences;

  // Pattern 3: Generic — look for bold company names + date ranges
  const genericPattern =
    /\\textbf\{([^}]+)\}[\s\S]*?(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})[^\\]*?)[\s\S]*?(\\begin\{itemize\}[\s\S]*?\\end\{itemize\})/g;
  while ((match = genericPattern.exec(section)) !== null) {
    const [, company, dates, items] = match;
    const { startDate, endDate } = parseDateRange(dates);
    experiences.push({
      company: stripLatex(company),
      title: 'Software Engineer',
      startDate,
      endDate,
      bullets: extractBullets(items),
    });
  }

  return experiences;
}

// ─── Education ───────────────────────────────────────────────────────────────

function extractEducation(tex: string): Education[] {
  const section = extractSection(tex, ['education', 'academic background', 'academics']);
  if (!section) return [];

  const educations: Education[] = [];

  const cventryPattern =
    /\\cventry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g;
  let match;
  while ((match = cventryPattern.exec(section)) !== null) {
    const [, dates, degree, institution, location, extra] = match;
    const { startDate, endDate } = parseDateRange(dates);
    educations.push({
      institution: stripLatex(institution),
      degree: stripLatex(degree),
      field: undefined,
      startDate,
      endDate,
      gpa: extractGPA(extra),
    });
  }

  if (educations.length > 0) return educations;

  const subheadingPattern =
    /\\resumeSubheading\s*\{([^}]*)\}\{([^}]*)\}\s*\{([^}]*)\}\{([^}]*)\}/g;
  while ((match = subheadingPattern.exec(section)) !== null) {
    const [, institution, dates, degree, location] = match;
    const { startDate, endDate } = parseDateRange(dates);
    educations.push({
      institution: stripLatex(institution),
      degree: stripLatex(degree),
      startDate,
      endDate,
    });
  }

  return educations;
}

// ─── Projects ────────────────────────────────────────────────────────────────

function extractProjects(tex: string): Project[] {
  const section = extractSection(tex, ['projects', 'personal projects', 'portfolio', 'side projects']);
  if (!section) return [];

  const projects: Project[] = [];

  // \resumeProjectHeading{\textbf{Name} $|$ \emph{tech1, tech2}}{date}
  const projectPattern =
    /\\resumeProjectHeading\s*\{([^}]*)\}\{[^}]*\}([\s\S]*?)(?=\\resumeProjectHeading|\\resumeSubheading|$)/g;
  let match;
  while ((match = projectPattern.exec(section)) !== null) {
    const [, header, content] = match;
    const namePart = header.match(/\\textbf\{([^}]+)\}/);
    const techPart = header.match(/\\emph\{([^}]+)\}|\\textit\{([^}]+)\}/);
    const technologies = techPart
      ? (techPart[1] ?? techPart[2]).split(',').map((t) => t.trim())
      : [];
    projects.push({
      name: namePart ? stripLatex(namePart[1]) : stripLatex(header),
      description: '',
      technologies,
      bullets: extractBullets(content),
    });
  }

  if (projects.length > 0) return projects;

  // Generic: bold project names
  const genericPattern =
    /\\textbf\{([^}]+)\}[^\n]*(\\begin\{itemize\}[\s\S]*?\\end\{itemize\})/g;
  while ((match = genericPattern.exec(section)) !== null) {
    const [, name, items] = match;
    projects.push({
      name: stripLatex(name),
      description: '',
      technologies: [],
      bullets: extractBullets(items),
    });
  }

  return projects;
}

// ─── Skills ──────────────────────────────────────────────────────────────────

function extractSkills(tex: string): string[] {
  const section = extractSection(tex, [
    'skills',
    'technical skills',
    'technologies',
    'programming languages',
    'tools',
  ]);
  if (!section) return [];

  const skills: string[] = [];
  const plain = texToPlainText(section);

  // Extract from colon-separated lists: "Languages: Python, JavaScript"
  const listPattern = /[A-Za-z\s]+:\s*([^\n]+)/g;
  let match;
  while ((match = listPattern.exec(plain)) !== null) {
    const items = match[1].split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    skills.push(...items);
  }

  if (skills.length > 0) return [...new Set(skills)];

  // Fallback: extract any words that look like tech
  const techPattern = /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Go|Rust|Ruby|PHP|Swift|Kotlin|React|Vue|Angular|Node\.js|Express|Django|Flask|Spring|AWS|GCP|Azure|Docker|Kubernetes|Git|PostgreSQL|MySQL|MongoDB|Redis)\b/g;
  const techMatches = plain.match(techPattern) ?? [];
  return [...new Set(techMatches)];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractSection(tex: string, names: string[]): string | null {
  const namePattern = names.map((n) => escapeRegex(n)).join('|');
  const sectionStart = new RegExp(
    `\\\\(?:section|cvsection|resumeSection)\\*?\\{(?:${namePattern})\\}`,
    'i'
  );

  const startMatch = tex.match(sectionStart);
  if (!startMatch || startMatch.index === undefined) return null;

  const start = startMatch.index + startMatch[0].length;
  const remainder = tex.slice(start);

  // Find next \section or end of document
  const nextSection = remainder.match(/\\(?:section|cvsection|resumeSection)\*?\{/);
  const end = nextSection?.index ?? remainder.length;

  return remainder.slice(0, end);
}

function extractBullets(content: string): string[] {
  const bullets: string[] = [];

  // \item text
  const itemPattern = /\\item\s+([\s\S]*?)(?=\\item|\\end\{itemize\}|\\end\{enumerate\}|$)/g;
  let match;
  while ((match = itemPattern.exec(content)) !== null) {
    const text = texToPlainText(match[1]).trim();
    if (text.length > 3) bullets.push(text);
  }

  return bullets;
}

function parseDateRange(dateStr: string): { startDate: string; endDate?: string } {
  const cleaned = stripLatex(dateStr).trim();

  // "Jan 2020 -- Present" or "2020 – 2022" or "2020-2022"
  const rangeMatch = cleaned.match(
    /(.+?)\s*(?:--|–|—|-{1,2})\s*(Present|Current|Now|\S+\s+\d{4}|\d{4})/i
  );
  if (rangeMatch) {
    return {
      startDate: rangeMatch[1].trim(),
      endDate: rangeMatch[2].trim(),
    };
  }

  // Single date
  if (cleaned.match(/\d{4}/)) {
    return { startDate: cleaned };
  }

  return { startDate: cleaned };
}

function extractGPA(text: string): string | undefined {
  const match = stripLatex(text).match(/GPA[:\s]+(\d+\.?\d*)/i);
  return match ? match[1] : undefined;
}

function stripLatex(text: string): string {
  return text
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\url\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function texToPlainText(tex: string): string {
  return tex
    .replace(/%.*$/gm, '')
    .replace(/\\begin\{[^}]+\}/g, '')
    .replace(/\\end\{[^}]+\}/g, '')
    .replace(/\$[^$]+\$/g, '')
    .replace(/\\[a-zA-Z]+\*?\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\*/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Resume Summary Builder ───────────────────────────────────────────────────

export function buildResumeContext(resume: ResumeData): string {
  const lines: string[] = [];

  if (resume.name) lines.push(`Name: ${resume.name}`);
  if (resume.summary) lines.push(`\nSummary: ${resume.summary}`);

  if (resume.skills.length > 0) {
    lines.push(`\nSkills: ${resume.skills.join(', ')}`);
  }

  if (resume.experience.length > 0) {
    lines.push('\nWork Experience:');
    for (const exp of resume.experience) {
      lines.push(
        `  • ${exp.title} at ${exp.company} (${exp.startDate} – ${exp.endDate ?? 'Present'})`
      );
      for (const bullet of exp.bullets.slice(0, 3)) {
        lines.push(`    - ${bullet}`);
      }
    }
  }

  if (resume.projects.length > 0) {
    lines.push('\nProjects:');
    for (const proj of resume.projects) {
      lines.push(`  • ${proj.name} [${proj.technologies.join(', ')}]`);
      if (proj.bullets[0]) lines.push(`    - ${proj.bullets[0]}`);
    }
  }

  if (resume.education.length > 0) {
    lines.push('\nEducation:');
    for (const edu of resume.education) {
      lines.push(`  • ${edu.degree} from ${edu.institution}`);
    }
  }

  return lines.join('\n');
}
