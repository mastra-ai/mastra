#!/usr/bin/env tsx
/**
 * Audit tool coverage per scenario. For every checked-in provider:
 *   - count tools shipped by the provider
 *   - extract tool ids referenced by its scenario (scenario file + requireTools list)
 *   - print missing tool ids so we know what to add to each scenario
 *
 * This is a static scan — it doesn't need the API to run.
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

const toolIdFromFile = (provider: string, file: string): string => {
  const src = readFileSync(file, 'utf8');
  const match = src.match(/id:\s*['"`]([a-z0-9_-]+)['"`]/i);
  if (!match) throw new Error(`Could not parse id from ${file}`);
  return match[1];
};

const providerTools = (provider: string): string[] => {
  const dir = join(providersRoot, provider, 'tools');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    // Underscore-prefixed files are shared helpers, not tools (e.g. discord/_bot-token.ts).
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') && !f.startsWith('_'))
    .map(f => join(dir, f));
  return files.map(f => toolIdFromFile(provider, f)).sort();
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
  if (existsSync(scenarioFile)) {
    const src = readFileSync(scenarioFile, 'utf8');
    const prefix = provider.replace(/-/g, '_');
    const re = new RegExp(`['"\`](${prefix}_[a-z0-9_]+)['"\`]`, 'g');
    for (const m of src.matchAll(re)) covered.add(m[1]);
  }

  const missing = tools.filter(t => !covered.has(t));
  // Reverse check: ids the scenario references that no shipped tool defines.
  // These are typos or stale references — they silently skip steps at runtime
  // (requireTools short-circuits, gated steps never fire) instead of failing loudly.
  const known = new Set(tools);
  const unknown = [...covered].filter(id => !known.has(id)).sort();
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
if (totalUnknown > 0) {
  console.log(`\n⚠️ ${totalUnknown} unknown tool id(s) referenced by scenarios — fix or remove them.`);
  process.exitCode = 1;
}
