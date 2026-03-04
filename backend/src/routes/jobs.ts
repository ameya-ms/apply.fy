import { Router } from 'express';
import axios from 'axios';

export const jobsRouter = Router();

// GET /api/jobs/search?query=software+engineer&location=remote&page=1
jobsRouter.get('/search', async (req, res) => {
  try {
    const { query = 'software engineer', location = 'United States', page = '1', remote } = req.query;
    const jsearchKey = req.headers['x-jsearch-key'] as string | undefined;

    if (!jsearchKey) {
      // Fall back to free Remotive API for remote jobs
      const { data } = await axios.get('https://remotive.com/api/remote-jobs', {
        params: { search: query, limit: 20 },
        timeout: 8000,
      });
      return res.json({ source: 'remotive', results: data.jobs ?? [] });
    }

    const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
      headers: {
        'X-RapidAPI-Key': jsearchKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      params: {
        query: `${query} in ${location}`,
        page: String(page),
        num_pages: '1',
        date_posted: 'week',
        remote_jobs_only: remote === 'true' ? 'true' : 'false',
      },
      timeout: 10000,
    });

    res.json({ source: 'jsearch', results: data.data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch jobs';
    res.status(500).json({ error: msg });
  }
});

// GET /api/jobs/muse?category=Software+Engineer&page=1
jobsRouter.get('/muse', async (req, res) => {
  try {
    const { category = 'Software Engineer', page = '0', location } = req.query;
    const apiKey = req.headers['x-muse-key'] as string | undefined;

    const params: Record<string, string> = {
      category: String(category),
      page: String(page),
      descending: 'true',
    };
    if (apiKey) params.api_key = apiKey;
    if (location) params.location = String(location);

    const { data } = await axios.get('https://www.themuse.com/api/public/jobs', {
      params,
      timeout: 8000,
    });

    res.json({ source: 'muse', results: data.results ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch Muse jobs';
    res.status(500).json({ error: msg });
  }
});
