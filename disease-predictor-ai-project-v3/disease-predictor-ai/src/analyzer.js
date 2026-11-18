const { AppError } = require('./errors');
const { buildPrompt } = require('./prompt');
const { parseAiJson, normalizeResult } = require('./validate');

const API_URL = 'https://api.anthropic.com/v1/messages';

function toContent(files, prompt) {
  const blocks = files.map((f) => {
    const data = f.buffer.toString('base64');
    const kind = f.mimetype === 'application/pdf' ? 'document' : 'image';
    return { type: kind, source: { type: 'base64', media_type: f.mimetype, data } };
  });
  return [...blocks, { type: 'text', text: prompt }];
}

/** Sends the uploaded report(s) to the multimodal AI model and returns a validated result. */
async function analyzeReports(files, langKey, cfg, fetchImpl = fetch) {
  if (!cfg.anthropicKey) throw new AppError(500, 'Server is not configured (missing ANTHROPIC_API_KEY).');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.aiTimeoutMs);
  try {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2500, messages: [{ role: 'user', content: toContent(files, buildPrompt(langKey)) }] }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new AppError(502, 'AI service error. Please try again.');
    const text = (out.content || []).map((b) => b.text || '').join('');
    return normalizeResult(parseAiJson(text));
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e.name === 'AbortError') throw new AppError(504, 'The AI took too long. Try a smaller file.');
    throw new AppError(502, 'Could not analyze the report. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
module.exports = { analyzeReports };
