import { el } from './dom.js';

const card = (title) => { const c = el('article', 'card'); c.append(el('h3', null, title)); return c; };
const list = (items) => { const u = el('ul'); (items || []).forEach((t) => u.append(el('li', null, t))); return u; };
const badge = (text, cls) => el('span', 'badge ' + cls, text);

function addFindings(root, d) {
  if (!d.findings?.length) return;
  const c = card('Key findings');
  d.findings.forEach((f) => {
    const row = el('div', 'item'), b = el('b', null, `${f.test}: ${f.value}`);
    b.append(badge(f.status, f.status));
    row.append(b, el('p', null, f.note)); c.append(row);
  });
  root.append(c);
}

function addConditions(root, d) {
  if (!d.conditions?.length) return;
  const c = card('Predicted possible conditions');
  d.conditions.forEach((x) => {
    const row = el('div', 'item'), b = el('b', null, x.name);
    b.append(badge(`${x.likelihood} chance`, x.likelihood));
    const bar = el('div', 'bar'), fill = document.createElement('i');
    bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `Confidence ${x.confidence} percent`);
    fill.style.width = x.confidence + '%'; bar.append(fill);
    row.append(b, el('p', null, `${x.reason} (confidence about ${x.confidence}%)`), bar); c.append(row);
  });
  root.append(c);
}

/** Renders the validated result into `root`. Uses textContent only (XSS-safe). */
export function renderResult(root, d, { onPrint, onJson }) {
  root.textContent = ''; root.hidden = false;
  const h = el('h2', null, 'Analysis result'); h.id = 'result-title'; root.append(h);

  if (!d.is_medical_report) {
    const c = card('Not a medical report');
    c.append(el('p', null, 'This file does not look like a medical report. Please upload a clear photo or PDF.'));
    root.append(c); root.focus(); return;
  }
  const head = card(d.report_type || 'Report summary'); head.append(el('p', null, d.summary)); root.append(head);
  addFindings(root, d); addConditions(root, d);

  if (d.tips?.length) {
    const c = card('Healthy living tips');
    d.tips.forEach((t) => { const row = el('div', 'item'); row.append(el('h4', null, t.for), list(t.advice)); c.append(row); });
    root.append(c);
  }
  if (d.diet?.eat?.length || d.diet?.avoid?.length) {
    const c = card('Diet guide'), g = el('div', 'two');
    const a = el('div'); a.append(el('h4', null, 'Eat more'), list(d.diet.eat));
    const b = el('div'); b.append(el('h4', null, 'Limit or avoid'), list(d.diet.avoid));
    g.append(a, b); c.append(g); root.append(c);
  }
  if (d.see_doctor) { const c = card('When to see a doctor'); c.append(el('p', null, d.see_doctor)); root.append(c); }

  const actions = el('div', 'actions');
  const p = el('button', 'btn ghost', 'Print report'); p.type = 'button'; p.addEventListener('click', onPrint);
  const j = el('button', 'btn ghost', 'Download JSON'); j.type = 'button'; j.addEventListener('click', onJson);
  actions.append(p, j); root.append(actions);
  root.scrollIntoView({ behavior: 'smooth' });
  root.focus({ preventScroll: true }); // moves screen-reader focus to the result
}
