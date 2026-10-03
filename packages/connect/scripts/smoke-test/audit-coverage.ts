#!/usr/bin/env tsx
/**
 * Audit tool coverage per scenario. For every checked-in provider:
 *   - count tools shipped by the provider
 *   - extract tool ids the scenario actually exercises (call/probeTool/
 *     runReadBatch invocations, or an explicit makeStep record for tools
 *     that are deliberately never invoked, e.g. destructive account-wide ops)
 *   - fail (exit 1) on coverage gaps and on referenced ids no tool defines
 *
 * A tool id that appears only in a comment or a `tools['x']` guard does NOT
 * count as covered. This is a static scan — it doesn't need the API to run.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const providersRoot = resolve(here, '..', '..', 'src', 'providers');
const scenariosRoot = resolve(here, 'scenarios');

type Report = {
  provider: string;
  total: number;
  covered: number;
  missing: string[];
  unknown: string[];
};

const toolIdFromFile = (file: string): string => {
  const src = readFileSync(file, 'utf8');
  const match = src.match(/id:\s*['"`]([a-z0-9_-]+)['"`]/i);
  if (!match?.[1]) throw new Error(`Could not parse id from ${file}`);
  return match[1];
};

const providerTools = (provider: string): string[] => {
  const dir = join(providersRoot, provider, 'tools');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    // Underscore-prefixed files are shared helpers, not tools (e.g. discord/_bot-token.ts).
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') && !f.startsWith('_'))
    .map(f => join(dir, f));
  return files.map(f => toolIdFromFile(f)).sort();
};

/**
 * Returns the argument text of every `<fnName>(...)` call in `src`, using a
 * balanced-paren scan (string-aware enough for our scenario files, which
 * never nest unbalanced parens inside the id strings we extract).
 */
const argumentSpans = (src: string, fnName: string): string[] => {
  const spans: string[] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf(`${fnName}(`, from);
    if (at === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = at + fnName.length; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;
    spans.push(src.slice(at + fnName.length + 1, end));
    from = end + 1;
  }
  return spans;
};

const providers = readdirSync(providersRoot)
  .filter(d => statSync(join(providersRoot, d)).isDirectory())
  .sort();

const reports: Report[] = [];

for (const provider of providers) {
  const tools = providerTools(provider);
  if (tools.length === 0) continue;

  const scenarioFile = join(scenariosRoot, `${provider}.ts`);
  const covered = new Set<string>();
  const referenced = new Set<string>();
  if (existsSync(scenarioFile)) {
    const src = readFileSync(scenarioFile, 'utf8');
    const prefix = provider.replace(/-/g, '_');
    const idPattern = `${prefix}_[a-z0-9_]+`;

    // Every quoted id anywhere in the file (guards, requireTools, comments in
    // string form) — used only for the unknown-id reverse check below.
    for (const m of src.matchAll(new RegExp(`['"\`](${idPattern})['"\`]`, 'g'))) {
      if (m[1]) referenced.add(m[1]);
    }

    // Coverage counts only exercise sites. Sanitize the source first:
    //   - strip comments, so an id mentioned in prose doesn't count
    //   - blank requireTools(...) spans, so preflight guard lists don't count
    // then count ids used as arguments / tuple elements (quote followed by
    // `,` or `)`), which covers call(), probeTool(), makeStep() records,
    // runReadBatch tuples, and local read-loop arrays. A bare `tools['id']`
    // presence guard is followed by `]` and therefore never counts; direct
    // `allTools['id'].execute` invocation is counted explicitly.
    let sanitized = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
    for (const span of argumentSpans(sanitized, 'requireTools')) {
      sanitized = sanitized.replace(span, ' '.repeat(span.length));
    }
    for (const m of sanitized.matchAll(new RegExp(`['"\`](${idPattern})['"\`]\\s*[,)]`, 'g'))) {
      if (m[1]) covered.add(m[1]);
    }
    for (const m of sanitized.matchAll(new RegExp(`\\[['"\`](${idPattern})['"\`]\\]\\s*\\.execute`, 'g'))) {
      if (m[1]) covered.add(m[1]);
    }
  }

  const missing = tools.filter(t => !covered.has(t));
  // Reverse check: ids the scenario references that no shipped tool defines.
  // These are typos or stale references — they silently skip steps at runtime
  // (requireTools short-circuits, gated steps never fire) instead of failing loudly.
  const known = new Set(tools);
  const unknown = [...referenced].filter(id => !known.has(id)).sort();
  reports.push({ provider, total: tools.length, covered: tools.length - missing.length, missing, unknown });
}

const totalTools = reports.reduce((n, r) => n + r.total, 0);
const totalCovered = reports.reduce((n, r) => n + r.covered, 0);

console.log(`\n@mastra/connect scenario coverage audit`);
console.log(`total tools across providers: ${totalTools}`);
console.log(`covered by scenarios:         ${totalCovered}  (${((totalCovered / totalTools) * 100).toFixed(1)}%)`);
console.log(`gap:                          ${totalTools - totalCovered}\n`);

for (const r of reports) {
  const pct = ((r.covered / r.total) * 100).toFixed(0);
  const bar = r.covered === r.total ? '✅' : r.covered === 0 ? '❌' : '◻️';
  console.log(`${bar} ${r.provider.padEnd(20)} ${r.covered}/${r.total}  (${pct}%)`);
  if (r.missing.length > 0 && r.missing.length <= 60) {
    for (const t of r.missing) console.log(`     - ${t}`);
  } else if (r.missing.length > 60) {
    console.log(`     (${r.missing.length} tools missing — too many to list)`);
  }
  for (const t of r.unknown) console.log(`     ⚠️ unknown tool id referenced: ${t}`);
}

const totalUnknown = reports.reduce((n, r) => n + r.unknown.length, 0);
const totalMissing = totalTools - totalCovered;
if (totalUnknown > 0) {
  console.log(`\n⚠️ ${totalUnknown} unknown tool id(s) referenced by scenarios — fix or remove them.`);
  process.exitCode = 1;
}
if (totalMissing > 0) {
  console.log(`\n⚠️ ${totalMissing} tool(s) not exercised by any scenario — 100% coverage is required.`);
  process.exitCode = 1;
}
