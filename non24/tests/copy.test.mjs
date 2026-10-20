import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCopy } from '../js/copy.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const copy = parseCopy(read('copy.md'));

test('every copy key used by the page and scripts exists in copy.md', () => {
  const used = new Set();
  for (const m of read('index.html').matchAll(/data-copy(?:-aria)?="([^"]+)"/g)) used.add(m[1]);
  for (const f of ['js/app.js', 'js/charts.js']) {
    for (const m of read(f).matchAll(/\b(?:t|html)\('([a-zA-Z0-9.]+)'/g)) used.add(m[1]);
    for (const m of read(f).matchAll(/'([a-z]+(?:\.[a-zA-Z0-9]+)+)'/g)) if (m[1].split('.').length > 1 && m[1] in copy) used.add(m[1]);
  }
  for (const tier of ['daylight', 'lamp', 'ember']) used.add(`legend.light.${tier}`); // built from lightTier()
  used.add('page.title'); used.add('page.description');
  const missing = [...used].filter((k) => !(k in copy));
  assert.deepEqual(missing, []);
});

test('parser joins lines and stops at rules', () => {
  const c = parseCopy('# Title\nintro\n## a.b\nline one\nline two\n\n---\nignored\n## c\n{x} *y*\n');
  assert.equal(c['a.b'], 'line one line two');
  assert.equal(c.c, '{x} *y*');
  assert.equal(Object.keys(c).length, 2);
});
