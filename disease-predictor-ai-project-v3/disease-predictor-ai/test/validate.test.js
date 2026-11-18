const test = require('node:test');
const assert = require('node:assert/strict');
const { detectType, parseAiJson, normalizeResult } = require('../src/validate');

test('detectType recognises real PNG, JPEG, PDF and rejects others', () => {
  assert.equal(detectType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0])), 'image/png');
  assert.equal(detectType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectType(Buffer.from('%PDF-1.7')), 'application/pdf');
  assert.equal(detectType(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(detectType(Buffer.alloc(0)), null);
});

test('parseAiJson strips code fences and extra prose', () => {
  assert.deepEqual(parseAiJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseAiJson('no json here'));
});

test('normalizeResult clamps enums, lengths and confidence', () => {
  const r = normalizeResult({
    is_medical_report: true, summary: 'x'.repeat(5000),
    findings: [{ test: 'Hb', value: '9', status: 'HACKED', note: 'n' }],
    conditions: [{ name: 'Anemia', likelihood: 'Extreme', confidence: 400, reason: 'low Hb' }],
    tips: [{ advice: ['drink water', '', 5] }],
  });
  assert.equal(r.summary.length, 800);
  assert.equal(r.findings[0].status, 'Borderline');
  assert.equal(r.conditions[0].likelihood, 'Low');
  assert.equal(r.conditions[0].confidence, 100);
  assert.deepEqual(r.tips[0], { for: 'General', advice: ['drink water'] });
  assert.deepEqual(r.diet, { eat: [], avoid: [] });
});

test('normalizeResult handles non-medical files and invalid input', () => {
  assert.deepEqual(normalizeResult({ is_medical_report: false }), { is_medical_report: false });
  assert.throws(() => normalizeResult(null));
  assert.throws(() => normalizeResult([]));
});
