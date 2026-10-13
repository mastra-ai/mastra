/**
 * OBS-591 heavy-query proof against the read-only replica: the old-shape `queryTraces()` list (Q0, Q3) and
 * the raw-table token/cost aggregate (E4) on the largest project's representative at 30 days, run with
 * today's profile cap (4 GiB) and with the OBS-591 read caps (1 GiB memory, 256 MiB result, 16 GiB read,
 * read-ahead 8). Expected: Q0/Q3 peak over 1 GiB uncapped and fail with 241 under the cap; E4 passes both.
 *
 *   npx tsx heavy-proof.ts [--reps 2] [--cases Q0,Q3,E4] [--window 30d]
 *
 * Output: case, arm, outcome, peak memory, duration, bytes read. No ids or rows are printed.
 */
import { parseArgs } from 'node:util';

import type { ClickHouseSettings } from '@clickhouse/client';

import { anchorTo, CASES, compileCase, timeRangeFor } from './cases';
import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { collectMetrics } from './metrics';
import { loadSelection } from './profile';

const MiB = 1024 ** 2;
const ARMS: Array<readonly [string, ClickHouseSettings]> = [
  ['today (4 GiB)', {}],
  [
    'OBS-591 caps',
    {
      filesystem_prefetches_limit: '8',
      max_memory_usage: String(1024 * MiB),
      max_result_bytes: String(256 * MiB),
      result_overflow_mode: 'throw',
      max_bytes_to_read: String(16 * 1024 * MiB),
      read_overflow_mode: 'throw',
    },
  ],
];

const { values } = parseArgs({
  options: {
    reps: { type: 'string', default: '2' },
    cases: { type: 'string', default: 'Q0,Q3,E4' },
    window: { type: 'string', default: '30d' },
  },
});

async function main() {
  installOutputRedaction();
  const selection = loadSelection();
  if (!selection) throw new Error('no selection file; run profile first');
  const project = selection.projects.find(p => p.bucket === 'largest' && p.representative);
  if (!project) throw new Error('no representative largest project');
  const client = new BenchClient({ ...loadCredentials(), database: selection.database });
  const tier = { ...TIERS[1], maxExecutionTimeS: 60 };
  const to = anchorTo(new Date());

  for (const id of values.cases.split(',')) {
    const def = CASES.find(c => c.id === id);
    const window = def?.windows.find(w => w.id === values.window);
    if (!def || !window) throw new Error(`no case ${id} with window ${values.window}`);
    const compiled = compileCase(def, 'base', project.literals, timeRangeFor(window, to), project);
    for (const [arm, settings] of ARMS) {
      for (let rep = 0; rep < Number(values.reps); rep++) {
        const logComment = `aqa-bench:heavy-proof:${id}:${arm}:${rep}`;
        const outcome = await client.discard(compiled.query, compiled.query_params, { tier, logComment, settings });
        const m = await collectMetrics(client, 'cluster', outcome, tier, 'aqa-bench:heavy-proof:qlog');
        console.log(
          [
            `${id} ${window.id}`.padEnd(8),
            arm.padEnd(14),
            outcome.ok ? 'ok      ' : `err ${outcome.errorCode}`.padEnd(8),
            `${Math.round(Number(m.memoryBytes ?? 0) / MiB)} MiB peak`.padEnd(14),
            `${Math.round(Number(m.durationMs ?? 0))} ms`.padEnd(10),
            `${Math.round(Number(m.readBytes ?? 0) / MiB)} MiB read`,
          ].join(' '),
        );
        await new Promise(r => setTimeout(r, 2_000));
      }
    }
  }
  await client.close();
}

await main();
