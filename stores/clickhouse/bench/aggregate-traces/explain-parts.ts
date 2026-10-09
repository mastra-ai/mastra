/**
 * Read-only: `EXPLAIN indexes = 1` for one representative project per bucket, printing only per-table
 * Parts / Granules selected after each index step. Conditions (which hold tenant literals) are never printed.
 *
 *   pnpm tsx bench/aggregate-traces/explain-parts.ts --case F3 --variants base,spb --window 7d [--buckets small,largest]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { CASES, compileCase, timeRangeFor } from './cases';
import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { loadSelection } from './profile';
import { PREFLIGHT_FILE } from './run';
import type { Variant } from './scope';

const { values } = parseArgs({
  options: {
    case: { type: 'string', default: 'F3' },
    variants: { type: 'string', default: 'base' },
    window: { type: 'string', default: '7d' },
    buckets: { type: 'string', default: 'small,largest' },
  },
});

/** Keeps only `ReadFromMergeTree (table)` headers, index-step names and `Parts:` / `Granules:` counts. */
export function summarizeExplain(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const table = /^ReadFromMergeTree \((?:[\w]+\.)?(\w+)\)/.exec(line)?.[1];
    if (table) out.push(table);
    else if (/^(MinMax|Partition|PrimaryKey|Skip|Ranges)$/.test(line)) out.push(`  ${line}`);
    else if (/^(Parts|Granules): \d+\/\d+$/.test(line)) out.push(`    ${line}`);
  }
  return out;
}

async function main() {
  installOutputRedaction();
  const credentials = loadCredentials();
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run `run.ts profile` first');
  const { database } = JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string };
  const client = new BenchClient({ ...credentials, database });
  const def = CASES.find(c => c.id === values.case);
  const window = def?.windows.find(w => w.id === values.window);
  if (!def || !window) throw new Error('Unknown case or window');
  const buckets = values.buckets!.split(',');
  try {
    for (const project of selection.projects.filter(p => p.representative && buckets.includes(p.bucket))) {
      for (const variant of values.variants!.split(',') as Variant[]) {
        const c = compileCase(
          def,
          variant,
          project.literals,
          timeRangeFor(window, new Date(selection.anchorTo)),
          project,
        );
        const out = await client.rows<{ explain: string }>(`EXPLAIN indexes = 1\n${c.query}`, c.query_params, {
          tier: TIERS[1],
          logComment: `aqa-bench:explain:${def.id}:${variant}:${project.hash}`,
        });
        process.stdout.write(`== ${project.bucket} ${def.id}/${variant}/${window.id}\n`);
        if (!out.ok) process.stdout.write(`  error ${out.errorCode}\n`);
        else process.stdout.write(`${summarizeExplain((out.rows ?? []).map(r => r.explain)).join('\n')}\n`);
      }
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
