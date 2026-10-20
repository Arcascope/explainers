// Site copy, loaded from copy.md so wording can be edited in one place.
//
// copy.md format: each `## key` heading starts an entry; the text up to the next
// heading (or a `---` rule) is its value. `{name}` placeholders are filled in by
// the page. In HTML contexts `*text*` becomes <em>, `` `text` `` <code>, and
// [text](https://url) a link; in plain-text contexts the markers are dropped.

let COPY = {};

export function parseCopy(md) {
  const out = {};
  let key = null, lines = [];
  const flush = () => { if (key) out[key] = lines.join(' ').replace(/\s+/g, ' ').trim(); };
  for (const line of md.split('\n')) {
    const h = /^##\s+(\S+)\s*$/.exec(line);
    if (h) { flush(); key = h[1]; lines = []; continue; }
    if (/^(---|#\s)/.test(line)) { flush(); key = null; lines = []; continue; }
    if (key) lines.push(line);
  }
  flush();
  return out;
}

export async function loadCopy(url = 'copy.md') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  COPY = parseCopy(await res.text());
}

function raw(key) {
  const s = COPY[key];
  if (s === undefined) { console.warn(`copy.md has no entry for "${key}"`); return key; }
  return s;
}

const fill = (s, vars, wrap = (v) => v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? wrap(String(vars[k])) : m));

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Plain text, with markdown markers removed.
export function t(key, vars = {}) {
  return fill(raw(key), vars)
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

// HTML with <em>, <code> and links; values and text are escaped.
export function html(key, vars = {}) {
  return fill(escape(raw(key)), vars, escape)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// Fill every [data-copy] element (data-* attributes are passed as placeholders)
// and every [data-copy-aria] aria-label; set the title and description.
export function applyCopy(root = document) {
  for (const el of root.querySelectorAll('[data-copy]')) el.innerHTML = html(el.dataset.copy, el.dataset);
  for (const el of root.querySelectorAll('[data-copy-aria]')) el.setAttribute('aria-label', t(el.dataset.copyAria));
  document.title = t('page.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('page.description'));
}
