import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Job,
  UserProfile,
  ResumeData,
  SearchPreferences,
  JobType,
  RemoteType,
} from '../types';

interface AppStore {
  // ─── State ───────────────────────────────────────────────────────────────
  isOnboarded: boolean;
  userProfile: UserProfile | null;
  resumeData: ResumeData | null;
  jobs: Job[];
  currentJobIndex: number;
  savedJobs: Job[];
  appliedJobs: Job[];
  skippedJobIds: Set<string>;
  searchPreferences: SearchPreferences;
  isLoadingJobs: boolean;
  jobsError: string | null;

  // ─── Actions: Onboarding ─────────────────────────────────────────────────
  setOnboarded: (value: boolean) => void;
  setUserProfile: (profile: UserProfile) => void;
  setResumeData: (data: ResumeData) => void;

  // ─── Actions: Jobs ────────────────────────────────────────────────────────
  setJobs: (jobs: Job[]) => void;
  appendJobs: (jobs: Job[]) => void;
  setLoadingJobs: (loading: boolean) => void;
  setJobsError: (error: string | null) => void;

  // ─── Actions: Swiping ────────────────────────────────────────────────────
  swipeRight: (job: Job) => void;  // Apply
  swipeLeft: (job: Job) => void;   // Skip
  swipeUp: (job: Job) => void;     // Save
  nextJob: () => void;

  // ─── Actions: Preferences ────────────────────────────────────────────────
  setSearchPreferences: (prefs: Partial<SearchPreferences>) => void;

  // ─── Actions: Saved/Applied ───────────────────────────────────────────────
  unsaveJob: (jobId: string) => void;
  updateAppliedJobStatus: (jobId: string, status: Job['status']) => void;

  // ─── Actions: Reset ───────────────────────────────────────────────────────
  resetSwipeSession: () => void;
  resetAll: () => void;
}

const DEFAULT_PREFERENCES: SearchPreferences = {
  roles: [],
  locations: [],
  remotePreference: 'any',
  jobTypes: ['full-time'],
  salaryMin: undefined,
  experienceLevel: 'any',
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ─── Initial State ─────────────────────────────────────────────────
      isOnboarded: false,
      userProfile: null,
      resumeData: null,
      jobs: [],
      currentJobIndex: 0,
      savedJobs: [],
      appliedJobs: [],
      skippedJobIds: new Set<string>(),
      searchPreferences: DEFAULT_PREFERENCES,
      isLoadingJobs: false,
      jobsError: null,

      // ─── Onboarding ────────────────────────────────────────────────────
      setOnboarded: (value) => set({ isOnboarded: value }),

      setUserProfile: (profile) =>
        set({
          userProfile: profile,
          searchPreferences: {
            ...get().searchPreferences,
            roles: profile.preferredRoles,
            locations: profile.preferredLocations,
            remotePreference: profile.remotePreference,
            salaryMin: profile.salaryMin,
          },
        }),

      setResumeData: (data) => set({ resumeData: data }),

      // ─── Jobs ──────────────────────────────────────────────────────────
      setJobs: (jobs) => set({ jobs, currentJobIndex: 0 }),

      appendJobs: (newJobs) => {
        const { jobs, skippedJobIds, appliedJobs, savedJobs } = get();
        const existingIds = new Set([
          ...jobs.map((j) => j.id),
          ...skippedJobIds,
          ...appliedJobs.map((j) => j.id),
          ...savedJobs.map((j) => j.id),
        ]);
        const unique = newJobs.filter((j) => !existingIds.has(j.id));
        set({ jobs: [...jobs, ...unique] });
      },

      setLoadingJobs: (loading) => set({ isLoadingJobs: loading }),
      setJobsError: (error) => set({ jobsError: error }),

      // ─── Swiping ───────────────────────────────────────────────────────
      swipeRight: (job) => {
        const applied = { ...job, status: 'applied' as const, appliedDate: new Date().toISOString() };
        set((state) => ({
          appliedJobs: [applied, ...state.appliedJobs],
          jobs: state.jobs.filter((j) => j.id !== job.id),
        }));
      },

      swipeLeft: (job) => {
        set((state) => ({
          skippedJobIds: new Set([...state.skippedJobIds, job.id]),
          jobs: state.jobs.filter((j) => j.id !== job.id),
        }));
      },

      swipeUp: (job) => {
        const saved = { ...job, status: 'saved' as const, savedDate: new Date().toISOString() };
        set((state) => ({
          savedJobs: [saved, ...state.savedJobs],
          jobs: state.jobs.filter((j) => j.id !== job.id),
        }));
      },

      nextJob: () =>
        set((state) => ({
          currentJobIndex: Math.min(state.currentJobIndex + 1, state.jobs.length - 1),
        })),

      // ─── Preferences ───────────────────────────────────────────────────
      setSearchPreferences: (prefs) =>
        set((state) => ({
          searchPreferences: { ...state.searchPreferences, ...prefs },
        })),

      // ─── Saved/Applied Management ──────────────────────────────────────
      unsaveJob: (jobId) =>
        set((state) => ({
          savedJobs: state.savedJobs.filter((j) => j.id !== jobId),
        })),

      updateAppliedJobStatus: (jobId, status) =>
        set((state) => ({
          appliedJobs: state.appliedJobs.map((j) =>
            j.id === jobId ? { ...j, status } : j
          ),
        })),

      // ─── Reset ─────────────────────────────────────────────────────────
      resetSwipeSession: () =>
        set({ jobs: [], currentJobIndex: 0, skippedJobIds: new Set() }),

      resetAll: () =>
        set({
          isOnboarded: false,
          userProfile: null,
          resumeData: null,
          jobs: [],
          currentJobIndex: 0,
          savedJobs: [],
          appliedJobs: [],
          skippedJobIds: new Set(),
          searchPreferences: DEFAULT_PREFERENCES,
          isLoadingJobs: false,
          jobsError: null,
        }),
    }),
    {
      name: 'apply-fy-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Skip serializing Sets — convert to arrays
      partialize: (state) => ({
        isOnboarded: state.isOnboarded,
        userProfile: state.userProfile,
        resumeData: state.resumeData,
        savedJobs: state.savedJobs,
        appliedJobs: state.appliedJobs,
        searchPreferences: state.searchPreferences,
        // Don't persist jobs or skipped IDs across sessions
      }),
    }
  )
);
