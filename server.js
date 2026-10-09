import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function cleanJson(text) {
  const cleaned = String(text).trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned);
}

const roleSkills = {
  'full stack developer': ['HTML','CSS','JavaScript','React','Node.js','Express','SQL','Git','REST API'],
  'frontend developer': ['HTML','CSS','JavaScript','React','Git','REST API'],
  'backend developer': ['Node.js','Express','SQL','REST API','Git','Docker'],
  'python developer': ['Python','Django','Flask','SQL','Git','REST API'],
  'software developer': ['JavaScript','Python','Java','SQL','Git','DSA','OOP']
};

function fallbackAnalyze(resume, targetRole, jd) {
  const text = `${resume}\n${jd}`.toLowerCase();
  const role = (targetRole || 'Software Developer').toLowerCase();
  const key = Object.keys(roleSkills).find(k => role.includes(k)) || 'software developer';
  const skills = roleSkills[key];
  const found = skills.filter(s => text.includes(s.toLowerCase()));
  const missing = skills.filter(s => !text.includes(s.toLowerCase()));
  const experience = /(experience|internship|project|developed|built|worked)/i.test(resume);
  const education = /(b\.tech|btech|bachelor|computer science|degree)/i.test(resume);
  let score = Math.round(35 + (found.length / skills.length) * 45 + (experience ? 10 : 0) + (education ? 10 : 0));
  score = Math.max(0, Math.min(100, score));
  const strengths = [];
  if (found.length) strengths.push(`Relevant skills found: ${found.slice(0,5).join(', ')}`);
  if (experience) strengths.push('Projects/experience are mentioned in the resume');
  if (education) strengths.push('Education/background is clearly stated');
  if (jd && jd.trim()) strengths.push('Job description was included for targeted matching');
  while (strengths.length < 3) strengths.push('Resume content is available for ATS evaluation');
  const weaknesses = missing.length ? missing.slice(0,5).map(s => `Add or demonstrate ${s}`) : ['Add measurable achievements and project impact'];
  return { score, strengths: strengths.slice(0,5), weaknesses: weaknesses.slice(0,5), recommendedJobs: [targetRole || 'Software Developer', 'Web Developer', 'Junior Software Engineer'], missingSkills: missing.slice(0,8) };
}

async function ollamaAnalyze(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const r = await fetch(process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'}, signal: controller.signal,
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3.2:3b', prompt, stream: false, format: 'json', options: { temperature: 0.2 } })
    });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    const data = await r.json();
    return cleanJson(data.response);
  } finally { clearTimeout(timer); }
}

async function readUploadedFile(file) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.txt')) return file.buffer.toString('utf8').trim();
  if (name.endsWith('.pdf')) {
    const parsed = await pdfParse(file.buffer);
    return (parsed.text || '').trim();
  }
  if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return (result.value || '').trim();
  }
  throw new Error('Unsupported file type. Please use PDF, DOCX or TXT.');
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/analyze', upload.single('resumeFile'), async (req, res) => {
  try {
    // If the user pasted text, keep it as a safe fallback even when a selected PDF/DOCX cannot be read.
    let resume = (req.body.resumeText || '').trim();
    let fileReadError = null;

    if (req.file) {
      try {
        const extracted = await readUploadedFile(req.file);
        if (extracted) resume = extracted;
        else fileReadError = 'The uploaded file contains no selectable text.';
      } catch (e) {
        fileReadError = e?.message || 'The uploaded file could not be read.';
      }
    }

    if (!resume) {
      return res.status(400).json({
        error: fileReadError
          ? `${fileReadError} If this is a scanned/image PDF, paste the resume text below instead.`
          : 'Resume content could not be read. Please upload a valid PDF/DOCX/TXT file or paste the resume text.'
      });
    }

    const jd = (req.body.jobDescription || '').trim();
    const targetRole = (req.body.targetRole || '').trim();
    const prompt = `Act as an ATS recruiter. Analyze this resume for target role: ${targetRole || 'Software Developer'}. Job description: ${jd || 'None'}. Return ONLY JSON: {"score":85,"strengths":["..."],"weaknesses":["..."],"recommendedJobs":["..."],"missingSkills":["..."]}. Arrays 3-6 concise items, score 0-100. Resume:\n${resume}`;

    let data;
    try {
      data = await ollamaAnalyze(prompt);
    } catch (e) {
      // No API key is required: use the local deterministic ATS analyzer when Ollama is unavailable.
      data = fallbackAnalyze(resume, targetRole, jd);
    }

    if (!data || typeof data.score !== 'number') throw new Error('Invalid analysis result');
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Analysis failed. Please try again.' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`CareerLens AI running at http://localhost:${port}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Stop the old Node process or use PORT=3001.`);
  else console.error(err);
});
