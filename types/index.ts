// ─── Job Types ─────────────────────────────────────────────────────────────

export type JobStatus = 'unseen' | 'saved' | 'applied' | 'skipped';
export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
export type JobSource = 'jsearch' | 'remotive' | 'muse' | 'manual';
export type RemoteType = 'remote' | 'hybrid' | 'onsite';
export type SwipeDirection = 'left' | 'right' | 'up';

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  applyUrl: string;
  postedDate?: string;
  jobType?: JobType;
  remote?: RemoteType;
  source: JobSource;
  matchScore?: number;
  status: JobStatus;
  appliedDate?: string;
  savedDate?: string;
  tags?: string[];
  benefits?: string[];
}

// ─── User Profile ──────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  resumeTexPath?: string;
  skills: string[];
  yearsExperience: number;
  preferredRoles: string[];
  preferredLocations: string[];
  salaryMin?: number;
  salaryMax?: number;
  remotePreference: RemoteType | 'any';
  openaiApiKey?: string;
  jsearchApiKey?: string;
  museApiKey?: string;
  backendUrl?: string;
}

// ─── Resume ────────────────────────────────────────────────────────────────

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  bullets: string[];
  current?: boolean;
}

export interface Education {
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  honors?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  link?: string;
  bullets: string[];
}

export interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  summary?: string;
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
  skills: string[];
  rawText?: string;
}

// ─── Application ───────────────────────────────────────────────────────────

export interface ApplicationQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'number';
  options?: string[];
  required?: boolean;
  answer?: string;
}

export interface ApplicationRecord {
  id: string;
  job: Job;
  appliedAt: string;
  answers: ApplicationQuestion[];
  coverLetter?: string;
  resumeVersion?: string;
  status: 'pending' | 'submitted' | 'interviewing' | 'rejected' | 'offer';
}

// ─── Preferences ───────────────────────────────────────────────────────────

export interface SearchPreferences {
  roles: string[];
  locations: string[];
  remotePreference: RemoteType | 'any';
  jobTypes: JobType[];
  salaryMin?: number;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'any';
}

// ─── Store Types ───────────────────────────────────────────────────────────

export interface AppState {
  isOnboarded: boolean;
  userProfile: UserProfile | null;
  resumeData: ResumeData | null;
  jobs: Job[];
  currentJobIndex: number;
  savedJobs: Job[];
  appliedJobs: Job[];
  searchPreferences: SearchPreferences;
  isLoadingJobs: boolean;
  jobsError: string | null;
}
