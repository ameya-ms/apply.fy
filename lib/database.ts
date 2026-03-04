import * as SQLite from 'expo-sqlite';
import type { Job } from '../types';

const DB_NAME = 'applyfy.db';
let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      company_logo TEXT,
      location TEXT NOT NULL,
      salary TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      description TEXT NOT NULL,
      requirements TEXT,
      responsibilities TEXT,
      apply_url TEXT NOT NULL,
      posted_date TEXT,
      job_type TEXT,
      remote TEXT,
      source TEXT NOT NULL,
      match_score REAL,
      status TEXT NOT NULL DEFAULT 'unseen',
      applied_date TEXT,
      saved_date TEXT,
      tags TEXT,
      benefits TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS swipe_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS application_answers (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_swipe_events_job_id ON swipe_events(job_id);
  `);
}

// ─── Job CRUD ──────────────────────────────────────────────────────────────

export async function upsertJobs(jobs: Job[]): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const job of jobs) {
      await database.runAsync(
        `INSERT OR REPLACE INTO jobs (
          id, title, company, company_logo, location, salary, salary_min, salary_max,
          description, requirements, responsibilities, apply_url, posted_date,
          job_type, remote, source, match_score, status, applied_date, saved_date,
          tags, benefits
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          job.id,
          job.title,
          job.company,
          job.companyLogo ?? null,
          job.location,
          job.salary ?? null,
          job.salaryMin ?? null,
          job.salaryMax ?? null,
          job.description,
          job.requirements ? JSON.stringify(job.requirements) : null,
          job.responsibilities ? JSON.stringify(job.responsibilities) : null,
          job.applyUrl,
          job.postedDate ?? null,
          job.jobType ?? null,
          job.remote ?? null,
          job.source,
          job.matchScore ?? null,
          job.status,
          job.appliedDate ?? null,
          job.savedDate ?? null,
          job.tags ? JSON.stringify(job.tags) : null,
          job.benefits ? JSON.stringify(job.benefits) : null,
        ]
      );
    }
  });
}

export async function getJobsByStatus(status: Job['status']): Promise<Job[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC',
    [status]
  );
  return rows.map(rowToJob);
}

export async function getUnseenJobs(limit = 50): Promise<Job[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM jobs WHERE status = ? ORDER BY match_score DESC, created_at DESC LIMIT ?',
    ['unseen', limit]
  );
  return rows.map(rowToJob);
}

export async function updateJobStatus(
  jobId: string,
  status: Job['status'],
  extra?: { appliedDate?: string; savedDate?: string }
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE jobs SET status = ?, applied_date = COALESCE(?, applied_date), saved_date = COALESCE(?, saved_date) WHERE id = ?`,
    [status, extra?.appliedDate ?? null, extra?.savedDate ?? null, jobId]
  );
}

export async function recordSwipeEvent(
  jobId: string,
  direction: 'left' | 'right' | 'up'
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO swipe_events (job_id, direction) VALUES (?, ?)',
    [jobId, direction]
  );
}

export async function getSwipeStats(): Promise<{
  total: number;
  applied: number;
  saved: number;
  skipped: number;
}> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    total: number;
    applied: number;
    saved: number;
    skipped: number;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN direction = 'right' THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN direction = 'up' THEN 1 ELSE 0 END) as saved,
      SUM(CASE WHEN direction = 'left' THEN 1 ELSE 0 END) as skipped
    FROM swipe_events
  `);
  return row ?? { total: 0, applied: 0, saved: 0, skipped: 0 };
}

// ─── Serialization ────────────────────────────────────────────────────────

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    title: row.title as string,
    company: row.company as string,
    companyLogo: (row.company_logo as string | null) ?? undefined,
    location: row.location as string,
    salary: (row.salary as string | null) ?? undefined,
    salaryMin: (row.salary_min as number | null) ?? undefined,
    salaryMax: (row.salary_max as number | null) ?? undefined,
    description: row.description as string,
    requirements: row.requirements ? JSON.parse(row.requirements as string) : undefined,
    responsibilities: row.responsibilities
      ? JSON.parse(row.responsibilities as string)
      : undefined,
    applyUrl: row.apply_url as string,
    postedDate: (row.posted_date as string | null) ?? undefined,
    jobType: (row.job_type as Job['jobType'] | null) ?? undefined,
    remote: (row.remote as Job['remote'] | null) ?? undefined,
    source: row.source as Job['source'],
    matchScore: (row.match_score as number | null) ?? undefined,
    status: row.status as Job['status'],
    appliedDate: (row.applied_date as string | null) ?? undefined,
    savedDate: (row.saved_date as string | null) ?? undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
    benefits: row.benefits ? JSON.parse(row.benefits as string) : undefined,
  };
}
