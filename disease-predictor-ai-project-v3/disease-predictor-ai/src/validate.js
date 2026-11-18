/** Input validation (file signatures) and strict normalisation of the AI's JSON output. */
const SIGNATURES = [
  ['image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['application/pdf', [0x25, 0x50, 0x44, 0x46]],
];

/** Detects the real type from magic bytes (the client-sent MIME type is never trusted). */
function detectType(buf) {
  for (const [type, sig] of SIGNATURES) if (sig.every((b, i) => buf[i] === b)) return type;
  return null;
}

const STATUS = ['Normal', 'Borderline', 'Abnormal'];
const LIKELIHOOD = ['Low', 'Medium', 'High'];
const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const clamp = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0; };
const strList = (v, max, len) => arr(v, max).map((x) => str(x, len)).filter(Boolean);

/** Extracts the first JSON object from model text (tolerates code fences / extra prose). */
function parseAiJson(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('No JSON in AI response');
  return JSON.parse(s.slice(a, b + 1));
}

/** Guarantees a safe, bounded shape no matter what the model returned. */
function normalizeResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid AI response');
  if (raw.is_medical_report === false) return { is_medical_report: false };
  return {
    is_medical_report: true,
    report_type: str(raw.report_type, 120),
    summary: str(raw.summary, 800),
    findings: arr(raw.findings, 5).map((f) => ({
      test: str(f?.test, 100), value: str(f?.value, 100), status: oneOf(f?.status, STATUS, 'Borderline'), note: str(f?.note, 300),
    })),
    conditions: arr(raw.conditions, 4).map((c) => ({
      name: str(c?.name, 120), likelihood: oneOf(c?.likelihood, LIKELIHOOD, 'Low'), confidence: clamp(c?.confidence), reason: str(c?.reason, 400),
    })),
    tips: arr(raw.tips, 6).map((t) => ({ for: str(t?.for, 100) || 'General', advice: strList(t?.advice, 5, 250) })),
    diet: { eat: strList(raw.diet?.eat, 8, 120), avoid: strList(raw.diet?.avoid, 8, 120) },
    see_doctor: str(raw.see_doctor, 500),
  };
}
module.exports = { detectType, parseAiJson, normalizeResult };
