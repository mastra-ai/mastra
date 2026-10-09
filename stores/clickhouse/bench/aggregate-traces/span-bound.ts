/**
 * Read-only exactness check for the `spb` / `rsb` time bounds (OBS-595) on the production read replica.
 * Runs each selected project's F3/Q3 query as compiled and with `spb`, and compares an in-SQL digest
 * (row count + order-independent hash of every result column). Prints only match / mismatch counts.
 *
 *   pnpm tsx bench/aggregate-traces/span-bound.ts [--variant spb|rsb] [--cases F3,Q3] [--windows 7d,30d]
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
    cases: { type: 'string', default: 'F3,Q3' },
    windows: { type: 'string', default: '7d,30d' },
    variant: { type: 'string', default: 'spb' },
    /** Project hash: print aggregate counts explaining why the bounded roots read differs. */
    diagnose: { type: 'string' },
  },
});

const chTime = (iso: string) => iso.replace('T', ' ').replace('Z', '');

async function main() {
  installOutputRedaction();
  const credentials = loadCredentials();
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run `run.ts profile` first');
  const { database } = JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string };
  const client = new BenchClient({ ...credentials, database });
  const to = new Date(selection.anchorTo);
  if (values.diagnose) {
    const project = selection.projects.find(p => p.hash === values.diagnose);
    if (!project) throw new Error('Unknown project hash');
    const range = timeRangeFor(
      CASES.find(c => c.id === 'F0')!.windows.find(w => w.id === '30d')!,
      to,
    );
    const out = await client.rows<Record<string, string>>(
      `WITH rows AS (
          SELECT traceId, spanId, startedAt, endedAt
          FROM mastra_trace_roots
          WHERE organizationId = {org:String} AND projectId = {project:String}
            AND traceId IN (
              SELECT traceId FROM mastra_trace_roots
              WHERE organizationId = {org:String} AND projectId = {project:String}
                AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')})
        )
        SELECT
          uniqExact(traceId) AS traces,
          count() AS rootRows,
          countIf(endedAt < startedAt) AS rowsEndBeforeStart,
          countIf(startedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {from:DateTime64(3, 'UTC')}) AS inWindowEndedBeforeFrom,
          countIf(startedAt < {from:DateTime64(3, 'UTC')} OR startedAt >= {to:DateTime64(3, 'UTC')}) AS rowsOutsideWindow,
          (SELECT count() FROM (SELECT traceId FROM rows GROUP BY traceId HAVING uniqExact(spanId) > 1)) AS multiRootTraces,
          (SELECT count() FROM (SELECT traceId FROM rows GROUP BY traceId HAVING uniqExact(startedAt) > 1 AND uniqExact(spanId) = 1)) AS oneRootManyStarts
        FROM rows`,
      { org: project.organizationId, project: project.projectId, from: chTime(range.from), to: chTime(range.to) },
      { tier: TIERS[1], logComment: `aqa-bench:spb-diagnose:${project.hash}` },
    );
    await client.close();
    const row = out.rows?.[0] ?? {};
    process.stdout.write(out.ok ? `${JSON.stringify(row)}\n` : `error ${out.errorCode}\n`);
    return;
  }
  const caseIds = values.cases!.split(',');
  const windowIds = values.windows!.split(',');
  let matched = 0;
  const mismatches: string[] = [];
  const failures: string[] = [];
  try {
    for (const def of CASES.filter(c => caseIds.includes(c.id))) {
      for (const window of def.windows.filter(w => windowIds.includes(w.id))) {
        for (const project of selection.projects) {
          const digest = async (variant: Variant) => {
            const c = compileCase(def, variant, project.literals, timeRangeFor(window, to), project);
            const out = await client.rows<{ n: string; h: string }>(
              `SELECT count() AS n, toString(groupBitXor(cityHash64(*))) AS h FROM (\n${c.query}\n)`,
              c.query_params,
              { tier: TIERS[1], logComment: `aqa-bench:spb-equiv:${def.id}:${variant}:${project.hash}` },
            );
            if (!out.ok) {
              process.stdout.write(`  error ${out.errorCode} (${variant})\n`);
              return undefined;
            }
            return `${out.rows?.[0]?.n}:${out.rows?.[0]?.h}`;
          };
          const label = `${def.id} ${window.id} ${project.bucket}:${project.hash}`;
          const [base, bounded] = [await digest('base'), await digest(values.variant as Variant)];
          if (base === undefined || bounded === undefined) failures.push(label);
          else if (base === bounded) matched++;
          else mismatches.push(label);
        }
      }
    }
  } finally {
    await client.close();
  }
  process.stdout.write(
    `${values.variant} exactness: ${matched} match, ${mismatches.length} mismatch, ${failures.length} failed\n`,
  );
  for (const m of mismatches) process.stdout.write(`  mismatch: ${m}\n`);
  for (const f of failures) process.stdout.write(`  failed: ${f}\n`);
  if (mismatches.length) process.exitCode = 1;
}

await main();
