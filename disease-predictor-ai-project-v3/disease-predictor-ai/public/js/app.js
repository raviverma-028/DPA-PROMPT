import { $ } from './dom.js';
import { el } from './dom.js';
import { createModal } from './modal.js';
import { createAuth } from './auth.js';
import { renderResult } from './render.js';

const MAX_FILES = 3, MAX_MB = 10;
const ALLOWED = ['image/png', 'image/jpeg', 'application/pdf'];
const state = { files: [], lastResult: null };

const say = (msg) => { $('status').textContent = msg; $('error').textContent = ''; };
const fail = (msg) => { $('error').textContent = msg; $('status').textContent = ''; };
const notify = (msg, isError) => (isError ? fail(msg) : say(msg));

const modal = createModal($('modal'), $('mclose'));
const auth = createAuth({ authBox: $('auth'), quotaBox: $('quota'), modalBtnBox: $('gbtn-modal'), modal, notify });

function addFiles(list) {
  for (const f of list) {
    if (!ALLOWED.includes(f.type)) { fail(`${f.name}: only PNG, JPG or PDF is allowed.`); continue; }
    if (f.size > MAX_MB * 1048576) { fail(`${f.name} is larger than ${MAX_MB} MB.`); continue; }
    if (state.files.length >= MAX_FILES) { fail(`You can upload up to ${MAX_FILES} files.`); break; }
    state.files.push(f);
  }
  renderFiles();
}

function renderFiles() {
  const ul = $('files'); ul.textContent = '';
  state.files.forEach((f, i) => {
    const li = el('li'); li.append(`${f.name} (${Math.round(f.size / 1024)} KB)`);
    const rm = el('button', null, 'Remove'); rm.type = 'button'; rm.setAttribute('aria-label', `Remove ${f.name}`);
    rm.addEventListener('click', () => { state.files.splice(i, 1); renderFiles(); });
    li.append(rm); ul.append(li);
  });
  $('go').disabled = !state.files.length;
}

/** Efficiency: large photos are downscaled in the browser before upload. */
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1048576) return file;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

function downloadJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state.lastResult, null, 2)], { type: 'application/json' }));
  a.download = 'prediction-report.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function setBusy(busy) {
  $('go').disabled = busy || !state.files.length;
  $('go').setAttribute('aria-busy', String(busy));
  $('go').textContent = busy ? 'Analyzing...' : 'Run analysis';
}

async function analyze() {
  if (!auth.canAnalyze()) return auth.isGuest() ? auth.showLogin() : fail('Daily limit reached. Please try again tomorrow.');
  setBusy(true); say('Uploading report...');
  try {
    const fd = new FormData();
    for (const f of state.files) fd.append('reports', await shrink(f));
    fd.append('lang', $('lang').value);
    say('Analyzing with AI. This can take up to a minute...');
    const res = await fetch('/api/analyze', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (data.loginRequired) auth.showLogin();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    state.lastResult = data;
    renderResult($('result'), data, { onPrint: () => window.print(), onJson: downloadJSON });
    say('Analysis complete.');
  } catch (e) { fail(e.message); }
  finally { setBusy(false); auth.refresh().catch(() => {}); }
}

$('file').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
$('go').addEventListener('click', analyze);
const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));

auth.init();
