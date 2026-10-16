// Usage:
//   node prompts.cjs collect <recordDir> <out.json>   -> merge JSONL records into { "file > test": [prompts] }
//   node prompts.cjs compare <base.json> <new.json>   -> report tests whose prompt sequence changed
const fs = require('fs');
const path = require('path');

const VOLATILE = new Set(['createdAt', 'timestamp', 'date']);
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9A-HJKMNP-TV-Z]{26}$/i;
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;

const TMP_RE = /(\/var\/folders\/[^/]+\/[^/]+\/T|\/tmp)\/([\w.-]*?)[-_]?[A-Za-z0-9]{6,}(?=[/"'\s]|$)/g;
const ID_KEY = /^(id|.*Id|.*_id)$/;

// ids: map each distinct random id to <id:N> by first appearance within one test, so pairing is kept.
function normalize(v, ids, key) {
  if (Array.isArray(v)) return v.map(x => normalize(x, ids));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) if (!VOLATILE.has(k)) o[k] = normalize(v[k], ids, k);
    return o;
  }
  if (typeof v === 'string') {
    if (ID_RE.test(v) || (key && ID_KEY.test(key))) {
      if (!ids.has(v)) ids.set(v, `<id:${ids.size}>`);
      return ids.get(v);
    }
    return v
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      .replace(/ \(\d{1,2}:\d{2} [AP]M\)(?=:)/g, '')
      .replace(ISO_RE, '<iso>')
      .replace(TMP_RE, '<tmp>/$2')
      .replace(/Duration: \d+ms/g, 'Duration: <n>ms')
      .replace(/(?<![0-9A-Za-z])[0-9a-f]{12,}(?![0-9A-Za-z])/g, '<hex>');
  }
  return v;
}

function collect(dir, out) {
  const map = {};
  const idMaps = {};
  for (const f of fs.readdirSync(dir)) {
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      const r = JSON.parse(line);
      const key = `${r.file} > ${r.test ?? '<outside test>'}`;
      (map[key] ??= []).push({ kind: r.kind, prompt: normalize(r.prompt, (idMaps[key] ??= new Map())) });
    }
  }
  const sorted = Object.fromEntries(Object.keys(map).sort().map(k => [k, map[k]]));
  fs.writeFileSync(out, JSON.stringify(sorted));
  const files = new Set(Object.keys(map).map(k => k.split(' > ')[0]));
  console.log(`tests: ${Object.keys(map).length}, files: ${files.size}, prompts: ${Object.values(map).flat().length}`);
}

function compare(a, b, unstableFile) {
  const A = JSON.parse(fs.readFileSync(a, 'utf8'));
  const B = JSON.parse(fs.readFileSync(b, 'utf8'));
  const unstable = new Set(unstableFile ? JSON.parse(fs.readFileSync(unstableFile, 'utf8')) : []);
  for (const k of unstable) { delete A[k]; delete B[k]; }
  const diff = [];
  for (const k of Object.keys(A)) {
    if (!(k in B)) diff.push(['missing', k]);
    else if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) diff.push(['changed', k]);
  }
  for (const k of Object.keys(B)) if (!(k in A)) diff.push(['new', k]);
  for (const [t, k] of diff) console.log(t.padEnd(8), k);
  console.log(`${diff.length} differences across ${Object.keys(A).length} baseline tests`);
  process.exitCode = diff.some(([t]) => t !== 'new') ? 1 : 0;
}

// unstable <out.json> <run1.json> <run2.json> ...: tests whose prompts differ between identical runs
function unstable(out, runs) {
  const R = runs.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const keys = new Set(R.flatMap(Object.keys));
  const bad = [...keys].filter(k => R.some(r => JSON.stringify(r[k]) !== JSON.stringify(R[0][k]))).sort();
  fs.writeFileSync(out, JSON.stringify(bad, null, 1));
  console.log(`${bad.length} unstable tests`);
}

const [cmd, x, y, ...rest] = process.argv.slice(2);
if (cmd === 'collect') collect(x, y);
else if (cmd === 'compare') compare(x, y, rest[0]);
else if (cmd === 'unstable') unstable(x, [y, ...rest]);
else console.error('usage: collect <dir> <out> | compare <base> <new>');
