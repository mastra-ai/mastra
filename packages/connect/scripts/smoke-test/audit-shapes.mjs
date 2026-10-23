// Static cross-check: smoke scenario call() inputs vs provider tool input schemas.
// Flags unknown input keys (silently stripped by Zod at runtime) and missing
// required keys (runtime validation failures). Heuristic — only checks
// object-literal inputs; spreads skip the required-key check.
//
// Usage: node audit-shapes.mjs [repo-root] — repo root defaults to the one
// containing this script, so it runs correctly from any working directory.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const providersRoot = join(root, 'packages/connect/src/providers');
const scenariosRoot = join(root, 'packages/connect/scripts/smoke-test/scenarios');

// ---- parse tool schemas: toolId -> { required: Set, all: Set } ----
const schemas = new Map();
for (const provider of readdirSync(providersRoot)) {
  const dir = join(providersRoot, provider, 'tools');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts') || f.startsWith('_')) continue;
    const src = readFileSync(join(dir, f), 'utf8');
    const idMatch = src.match(/id:\s*['"`]([a-z0-9_]+)['"`]/i);
    if (!idMatch) continue;
    // `z.object({` may be line-broken by the formatter (`z\n  .object({`).
    const schemaMatch = src.match(/export const \w+InputSchema\s*=\s*z\s*\n?\s*\.object\(\{/);
    if (!schemaMatch) {
      schemas.set(idMatch[1], null);
      continue;
    }
    const start = src.indexOf('{', schemaMatch.index + schemaMatch[0].length - 1);
    // walk braces to find the schema object body
    let depth = 0,
      end = start;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = src.slice(start + 1, end);
    // top-level keys: at brace/paren depth 0 within body
    const all = new Set();
    const required = new Set();
    let d = 0,
      p = 0;
    const lines = [];
    let cur = '';
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '{') d++;
      else if (c === '}') d--;
      else if (c === '(') p++;
      else if (c === ')') p--;
      if (c === ',' && d === 0 && p === 0) {
        lines.push(cur);
        cur = '';
      } else cur += c;
    }
    if (cur.trim()) lines.push(cur);
    for (const seg of lines) {
      const km = seg.match(/^\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*:/);
      if (!km) continue;
      all.add(km[1]);
      if (!/\.optional\(\)|\.nullish\(\)|\.default\(|:\s*z\.optional\(/.test(seg)) required.add(km[1]);
    }
    schemas.set(idMatch[1], { all, required });
  }
}

// ---- parse scenario call sites ----
let findings = 0;
let checked = 0;
let skippedNonLiteral = 0; // call('id', variable) / call('id', [...]) — not an object literal
let skippedNoSchema = 0; // tool whose InputSchema the parser couldn't extract
for (const f of readdirSync(scenariosRoot)) {
  if (!f.endsWith('.ts') || f === 'index.ts') continue;
  const src = readFileSync(join(scenariosRoot, f), 'utf8');
  // All call sites, regardless of second-arg shape, so skips are countable.
  for (const m of src.matchAll(/call(?:<[^>]*>)?\(\s*['"]([a-z0-9_]+)['"]\s*,\s*([^\s{])/g)) {
    if (schemas.get(m[1]) !== undefined) skippedNonLiteral++;
  }
  // Three call-site shapes feed a tool an object literal:
  //   call('tool_id', {...})                       — direct calls
  //   ['tool_id', {...}]                           — runReadBatch tuples
  //   probeTool(call, tools, 'label', 'tool_id', {...})
  // Tuple matches are gated on the id existing in the schema map, so
  // unrelated ['string', {...}] arrays never produce findings.
  const re =
    /(?:call(?:<[^>]*>)?\(\s*['"]([a-z0-9_]+)['"]|\[\s*['"]([a-z0-9_]+)['"]|probeTool\([^)]*?['"]([a-z0-9_]+)['"])\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const toolId = m[1] ?? m[2] ?? m[3];
    const schema = schemas.get(toolId);
    if (schema === undefined) continue; // unknown id — covered by audit-coverage
    if (schema === null) {
      skippedNoSchema++;
      continue; // couldn't parse schema
    }
    checked++;
    const start = re.lastIndex - 1;
    let depth = 0,
      end = start;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = src.slice(start + 1, end);
    const hasSpread = /\.\.\./.test(body);
    // top-level keys of the literal
    const keys = new Set();
    let d = 0,
      p = 0,
      b = 0;
    let cur = '';
    const segs = [];
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '{') d++;
      else if (c === '}') d--;
      else if (c === '(') p++;
      else if (c === ')') p--;
      else if (c === '[') b++;
      else if (c === ']') b--;
      if (c === ',' && d === 0 && p === 0 && b === 0) {
        segs.push(cur);
        cur = '';
      } else cur += c;
    }
    if (cur.trim()) segs.push(cur);
    for (const seg of segs) {
      const t = seg.trim();
      if (t.startsWith('...')) continue;
      const km = t.match(/^['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*[:,]?/);
      if (km && (t.includes(':') || /^[A-Za-z_][A-Za-z0-9_]*$/.test(t))) keys.add(km[1]);
    }
    const line = src.slice(0, m.index).split('\n').length;
    for (const k of keys) {
      if (!schema.all.has(k)) {
        console.log(`${f}:${line}  ${toolId}  unknown input key: ${k}  (schema keys: ${[...schema.all].join(', ')})`);
        findings++;
      }
    }
    if (!hasSpread) {
      for (const k of schema.required) {
        if (!keys.has(k)) {
          console.log(`${f}:${line}  ${toolId}  missing required key: ${k}`);
          findings++;
        }
      }
    }
  }
}
console.log(`\nchecked ${checked} object-literal call site(s)`);
if (skippedNonLiteral > 0) {
  console.log(
    `⚠️ skipped ${skippedNonLiteral} call site(s) whose input is not an object literal (variable/array) — not shape-checked`,
  );
}
if (skippedNoSchema > 0) {
  console.log(
    `⚠️ skipped ${skippedNoSchema} call site(s) whose tool InputSchema could not be parsed — not shape-checked`,
  );
}
console.log(`${findings} finding(s)`);
process.exit(findings > 0 ? 1 : 0);
