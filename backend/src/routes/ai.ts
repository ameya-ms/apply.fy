import { Router } from 'express';
import OpenAI from 'openai';

export const aiRouter = Router();

// POST /api/ai/answer
// Body: { question, jobTitle, company, description, resumeContext, profileContext }
aiRouter.post('/answer', async (req, res) => {
  try {
    const { question, jobTitle, company, description, resumeContext, profileContext, maxWords = 150 } = req.body;
    const apiKey = req.headers['x-openai-key'] as string | undefined;

    if (!apiKey) return res.status(401).json({ error: 'OpenAI API key required' });

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional job application assistant. Write concise, authentic first-person answers under ${maxWords} words.\n\nCANDIDATE CONTEXT:\n${profileContext}\n\n${resumeContext}`,
        },
        {
          role: 'user',
          content: `Job: ${jobTitle} at ${company}\nDescription: ${description?.slice(0, 500)}\n\nQuestion: "${question}"\n\nWrite my answer:`,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    res.json({ answer: response.choices[0]?.message?.content?.trim() ?? '' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI error' });
  }
});

// POST /api/ai/cover-letter
aiRouter.post('/cover-letter', async (req, res) => {
  try {
    const { jobTitle, company, description, resumeContext, profileContext, style = 'formal' } = req.body;
    const apiKey = req.headers['x-openai-key'] as string | undefined;

    if (!apiKey) return res.status(401).json({ error: 'OpenAI API key required' });

    const client = new OpenAI({ apiKey });

    const toneMap: Record<string, string> = {
      formal: 'Professional and formal',
      casual: 'Friendly and conversational',
      startup: 'Energetic and culture-fit focused',
    };

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write a 3-paragraph cover letter (~200 words). Tone: ${toneMap[style] ?? 'Professional'}.\n\nCANDIDATE:\n${profileContext}\n${resumeContext}\n\nJOB:\n${jobTitle} at ${company}\n${description?.slice(0, 600)}\n\nFormat as plain text. Include [DATE] and [HIRING MANAGER] placeholders.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    res.json({ coverLetter: response.choices[0]?.message?.content?.trim() ?? '' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI error' });
  }
});

// POST /api/ai/score
// Body: { jobTitle, description, skills, yearsExperience, preferredRoles }
aiRouter.post('/score', async (req, res) => {
  try {
    const { jobTitle, description, skills, yearsExperience, preferredRoles } = req.body;
    const apiKey = req.headers['x-openai-key'] as string | undefined;

    if (!apiKey) return res.status(401).json({ error: 'OpenAI API key required' });

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Rate job match 0-100. Return ONLY JSON: {"score": number, "reasons": string[]}\n\nCANDIDATE SKILLS: ${skills}\nEXPERIENCE: ${yearsExperience} years\nPREFERRED ROLES: ${preferredRoles}\n\nJOB: ${jobTitle}\n${description?.slice(0, 400)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
    res.json({ score: Math.max(0, Math.min(100, parsed.score ?? 50)), reasons: parsed.reasons ?? [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI error' });
  }
});
