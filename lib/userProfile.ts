import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import type { UserProfile } from '../types';

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
  const parseList = (val?: string): string[] =>
    val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const parseNumber = (val?: string): number | undefined => {
    if (!val) return undefined;
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : n;
  };

  const remoteRaw = env['REMOTE_PREFERENCE']?.toLowerCase() ?? 'any';
  const remotePreference =
    remoteRaw === 'remote' || remoteRaw === 'hybrid' || remoteRaw === 'onsite'
      ? (remoteRaw as 'remote' | 'hybrid' | 'onsite')
      : 'any';

  return {
    name: env['NAME'] ?? '',
    email: env['EMAIL'] ?? '',
    phone: env['PHONE'] ?? '',
    linkedinUrl: env['LINKEDIN_URL'] ?? undefined,
    portfolioUrl: env['PORTFOLIO_URL'] ?? undefined,
    githubUrl: env['GITHUB_URL'] ?? undefined,
    resumeTexPath: env['RESUME_TEX_PATH'] ?? undefined,
    skills: parseList(env['SKILLS']),
    yearsExperience: parseNumber(env['YEARS_EXPERIENCE']) ?? 0,
    preferredRoles: parseList(env['PREFERRED_ROLES']),
    preferredLocations: parseList(env['PREFERRED_LOCATIONS']),
    salaryMin: parseNumber(env['SALARY_MIN']),
    salaryMax: parseNumber(env['SALARY_MAX']),
    remotePreference,
    openaiApiKey: env['OPENAI_API_KEY'] ?? undefined,
    jsearchApiKey: env['JSEARCH_API_KEY'] ?? undefined,
    museApiKey: env['MUSE_API_KEY'] ?? undefined,
    backendUrl: env['BACKEND_URL'] ?? undefined,
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
  if (!profile.openaiApiKey) warnings.push('No OpenAI API key — AI features disabled');
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
