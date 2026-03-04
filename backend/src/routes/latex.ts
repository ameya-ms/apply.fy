import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);
export const latexRouter = Router();

// POST /api/latex/compile
// Body: { tex: string } (raw LaTeX content)
// Returns: PDF as base64 or binary
latexRouter.post('/compile', async (req: Request, res: Response) => {
  const { tex } = req.body as { tex?: string };

  if (!tex || typeof tex !== 'string') {
    return res.status(400).json({ error: 'Missing tex content' });
  }

  const tempDir = tmpdir();
  const jobId = `resume_${Date.now()}`;
  const texPath = join(tempDir, `${jobId}.tex`);
  const pdfPath = join(tempDir, `${jobId}.pdf`);

  try {
    // Write .tex file
    writeFileSync(texPath, tex, 'utf-8');

    // Compile with pdflatex (must be installed on server)
    // Run twice for proper references/TOC
    const cmd = `pdflatex -interaction=nonstopmode -output-directory="${tempDir}" "${texPath}"`;
    await execAsync(cmd, { timeout: 30000 });
    await execAsync(cmd, { timeout: 30000 });

    if (!existsSync(pdfPath)) {
      return res.status(500).json({ error: 'PDF compilation failed' });
    }

    const pdfBuffer = readFileSync(pdfPath);
    const base64 = pdfBuffer.toString('base64');

    res.json({
      success: true,
      pdf: base64,
      size: pdfBuffer.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Compilation error';
    // Check if pdflatex is not installed
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      return res.status(503).json({
        error: 'pdflatex not installed on server. Install TeX Live: sudo apt install texlive-full',
      });
    }
    res.status(500).json({ error: msg });
  } finally {
    // Cleanup temp files
    [texPath, pdfPath, `${join(tempDir, jobId)}.aux`, `${join(tempDir, jobId)}.log`].forEach(
      (f) => { try { if (existsSync(f)) unlinkSync(f); } catch {} }
    );
  }
});
