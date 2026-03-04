import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import type { UserProfile, ResumeData } from '../types';

const PROFILE_KEY = 'user_profile_v1';
const ENV_CONTENT_KEY = 'env_content_v1';

// ─── Profile Storage ──────────────────────────────────────────────────────────

export async function saveProfile(profile: UserProfile): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function clearProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(PROFILE_KEY);
  await SecureStore.deleteItemAsync(ENV_CONTENT_KEY);
  const infoDir = `${FileSystem.documentDirectory}info/`;
  const info = await FileSystem.getInfoAsync(infoDir);
  if (info.exists) {
    await FileSystem.deleteAsync(infoDir, { idempotent: true });
  }
}

// ─── Info Folder Helpers ───────────────────────────────────────────────────────

const INFO_DIR = `${FileSystem.documentDirectory}info/`;

export async function saveResumeJSON(data: ResumeData): Promise<void> {
  await FileSystem.makeDirectoryAsync(INFO_DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(
    `${INFO_DIR}resume.json`,
    JSON.stringify(data, null, 2),
    { encoding: FileSystem.EncodingType.UTF8 }
  );
}

export async function loadResumeJSON(): Promise<ResumeData | null> {
  const path = `${INFO_DIR}resume.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
    return JSON.parse(raw) as ResumeData;
  } catch {
    return null;
  }
}

export async function saveProfileEnvFile(profile: UserProfile): Promise<string> {
  await FileSystem.makeDirectoryAsync(INFO_DIR, { intermediates: true });
  const lines = [
    '# apply.fy profile — generated automatically',
    `NAME_name=${profile.name}`,
    `NAME_email=${profile.email}`,
    profile.phone ? `NAME_phone=${profile.phone}` : '',
    profile.linkedinUrl ? `NAME_linkedin_url=${profile.linkedinUrl}` : '',
    profile.githubUrl ? `NAME_github_url=${profile.githubUrl}` : '',
    profile.portfolioUrl ? `NAME_portfolio_url=${profile.portfolioUrl}` : '',
    profile.skills.length > 0 ? `NAME_skills=${profile.skills.join(',')}` : '',
    `NAME_years_experience=${profile.yearsExperience}`,
    profile.preferredRoles.length > 0 ? `NAME_preferred_roles=${profile.preferredRoles.join(',')}` : '',
    profile.preferredLocations.length > 0 ? `NAME_preferred_locations=${profile.preferredLocations.join(',')}` : '',
    `NAME_remote_preference=${profile.remotePreference}`,
    profile.salaryMin ? `NAME_salary_min=${profile.salaryMin}` : '',
    profile.salaryMax ? `NAME_salary_max=${profile.salaryMax}` : '',
    profile.anthropicApiKey ? `NAME_anthropic_api_key=${profile.anthropicApiKey}` : '',
    profile.jsearchApiKey ? `NAME_jsearch_api_key=${profile.jsearchApiKey}` : '',
  ].filter(Boolean);
  const content = lines.join('\n') + '\n';
  const path = `${INFO_DIR}profile.env`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

// ─── .env File Parser ─────────────────────────────────────────────────────────

export function parseEnvFile(content: string): UserProfile {
  const lines = content.split('\n');
  const env: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Strip inline comments
    const commentIdx = value.indexOf(' #');
    if (commentIdx > 0) value = value.slice(0, commentIdx).trim();

    if (key && value) env[key] = value;
  }

  return buildProfileFromEnv(env);
}

function buildProfileFromEnv(env: Record<string, string>): UserProfile {
  // Support both NAME_key format (new) and LEGACY_KEY format (old .env imports)
  const get = (nameKey: string, legacyKey: string): string | undefined =>
    env[`NAME_${nameKey}`] ?? env[legacyKey] ?? undefined;

  const parseList = (val?: string): string[] =>
    val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const parseNumber = (val?: string): number | undefined => {
    if (!val) return undefined;
    const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? undefined : n;
  };

  const remoteRaw = (get('remote_preference', 'REMOTE_PREFERENCE') ?? 'any').toLowerCase();
  const remotePreference =
    remoteRaw === 'remote' || remoteRaw === 'hybrid' || remoteRaw === 'onsite'
      ? (remoteRaw as 'remote' | 'hybrid' | 'onsite')
      : 'any';

  return {
    name: get('name', 'NAME') ?? '',
    email: get('email', 'EMAIL') ?? '',
    phone: get('phone', 'PHONE') ?? '',
    linkedinUrl: get('linkedin_url', 'LINKEDIN_URL'),
    portfolioUrl: get('portfolio_url', 'PORTFOLIO_URL'),
    githubUrl: get('github_url', 'GITHUB_URL'),
    resumeTexPath: get('resume_tex_path', 'RESUME_TEX_PATH'),
    skills: parseList(get('skills', 'SKILLS')),
    yearsExperience: parseNumber(get('years_experience', 'YEARS_EXPERIENCE')) ?? 0,
    preferredRoles: parseList(get('preferred_roles', 'PREFERRED_ROLES')),
    preferredLocations: parseList(get('preferred_locations', 'PREFERRED_LOCATIONS')),
    salaryMin: parseNumber(get('salary_min', 'SALARY_MIN')),
    salaryMax: parseNumber(get('salary_max', 'SALARY_MAX')),
    remotePreference,
    anthropicApiKey: get('anthropic_api_key', 'ANTHROPIC_API_KEY'),
    jsearchApiKey: get('jsearch_api_key', 'JSEARCH_API_KEY'),
    museApiKey: get('muse_api_key', 'MUSE_API_KEY'),
    backendUrl: get('backend_url', 'BACKEND_URL'),
  };
}

// ─── Resume File Helpers ──────────────────────────────────────────────────────

export async function readTexFile(uri: string): Promise<string> {
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return content;
}

export async function saveTexFileToDisk(uri: string): Promise<string> {
  const destDir = `${FileSystem.documentDirectory}resume/`;
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const dest = `${destDir}resume.tex`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function loadSavedTexFile(): Promise<string | null> {
  const path = `${FileSystem.documentDirectory}resume/resume.tex`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ProfileValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProfile(profile: UserProfile): ProfileValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!profile.name?.trim()) errors.push('Name is required');
  if (!profile.email?.trim()) errors.push('Email is required');
  if (profile.email && !isValidEmail(profile.email)) errors.push('Invalid email format');
  if (!profile.phone?.trim()) warnings.push('Phone number missing (needed for some applications)');
  if (!profile.anthropicApiKey) warnings.push('No Anthropic API key — AI features disabled');
  if (!profile.jsearchApiKey && !profile.museApiKey) {
    warnings.push('No job API keys — using demo jobs only');
  }
  if (profile.preferredRoles.length === 0) {
    warnings.push('No preferred roles set — add roles for better job recommendations');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Profile → Application Form Data ─────────────────────────────────────────

export function profileToFormData(profile: UserProfile): Record<string, string> {
  return {
    first_name: profile.name.split(' ')[0] ?? profile.name,
    last_name: profile.name.split(' ').slice(1).join(' '),
    full_name: profile.name,
    email: profile.email,
    phone: profile.phone,
    linkedin: profile.linkedinUrl ?? '',
    portfolio: profile.portfolioUrl ?? '',
    github: profile.githubUrl ?? '',
    years_experience: String(profile.yearsExperience),
    skills: profile.skills.join(', '),
  };
}
