/**
 * Local equivalence check for the memory-experiment rewrites (variants.ts). Never touches the replica.
 *
 *   docker run -d --name tq-exp-smoke -p 18125:8123 -e CLICKHOUSE_PASSWORD=password clickhouse/clickhouse-server:26.4
 *   TQ_SMOKE_URL=http://localhost:18125 tsx bench/trace-query/experiments.smoke.ts
 *   docker rm -f tq-exp-smoke
 *
 * Loads the smoke fixture, then adds duplicate root rows the way the store can produce them:
 * - exact copies (same dedupeKey, not yet merged by ReplacingMergeTree),
 * - same content under a second dedupeKey,
 * - (separate pass) copies whose content differs, the case the duplicate census must rule out on prod.
 * For every case × variant, base and variant results are compared row by row, and the server-side hash used by
 * `experiments.ts equiv` must reach the same verdict.
 */
import { createClient } from '@clickhouse/client';

import { BenchClient, TIERS } from '../shared/client';
import { DOC_LITERALS } from '../shared/profile';
import { caseById, compileCase, timeRangeFor, WINDOWS } from './cases';
import type { TraceQueryLiterals } from './cases';
import { hashStatement } from './experiments';
import { DB, LOCAL, ORG, PROJECTS, setup } from './smoke';
import type { Statement } from './stages';
import { keyOnly } from './stages';
import { planVariant, resultColumns } from './variants';

const CASES = ['T0', 'T1', 'T3', 'T4', 'T7', 'T9', 'T10', 'O1', 'O2', 'K1', 'D1', 'P0', 'P1', 'P3', 'G0'];
const VARIANTS = [
  'nh',
  'nh2',
  'rs',
  'topn',
  'topn2',
  'nh2+topn2',
  'pg',
  'dtop',
  'dtop+rs',
  'dtop+rs+nh',
  'sp',
  'sp+nh2+topn2',
  'g2',
  'nh+rs',
  'nh2+rs',
  'topn+rs',
];
/** Variants that must stay equivalent even when root copies differ in content (they hydrate the chosen copy). */
const CONTENT_SAFE = new Set(['nh', 'nh2']);

const log = (m: string) => process.stdout.write(`${m}\n`);

type Row = Record<string, unknown>;

async function main() {
  const to = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 + 3_600_000);
  await setup(to);
  const admin = createClient({ ...LOCAL, database: DB });
  const client = new BenchClient({
    origin: LOCAL.url,
    username: LOCAL.username,
    password: LOCAL.password,
    database: DB,
  });
  const opts = { tier: TIERS[1], logComment: 'tq-exp-smoke' };
  const literals: TraceQueryLiterals = {
    ...DOC_LITERALS,
    metadataValue: 'tenant-1',
    tag: 'beta',
    model: 'gpt-4o',
    entityName: 'Agent 1',
    feedbackType: 'rating',
  };
  const scope = { organizationId: ORG, projectId: PROJECTS.a };
  const timeRange = timeRangeFor(WINDOWS['30d'], to);

  const rows = async (statement: Statement): Promise<Row[]> => {
    const out = await client.rows<Row>(statement.query, statement.query_params, {
      ...opts,
      sharedSnapshot: statement.sharedSnapshot,
    });
    if (!out.ok) throw new Error(`query failed: ${out.errorMessage}\n${statement.query}`);
    return out.rows!;
  };
  const hash = async (statement: Statement, columns: string[]) => (await rows(hashStatement(statement, columns)))[0];
  const norm = (rs: Row[], columns: string[]) => JSON.stringify(rs.map(r => columns.map(c => r[c] ?? null)));

  const deltaHead = async () => {
    const r = await rows({
      query: `SELECT toString(max(cursorId)) AS c, argMax(traceId, cursorId) AS t FROM mastra_trace_roots_delta`,
      query_params: {},
    });
    return { cursorId: String(r[0]!.c), traceId: String(r[0]!.t) };
  };

  const pass = async (label: string, contentDiffers: boolean) => {
    let compared = 0;
    let failures = 0;
    for (const caseId of CASES) {
      const def = caseById(caseId);
      const head = def.api === 'delta' ? await deltaHead() : undefined;
      const cursor = def.api === 'delta' ? ({ kind: 'delta', cursorId: '0', traceId: '' } as const) : undefined;
      const base = compileCase(def, 'base', literals, timeRange, scope, { cursor, deltaHead: head }).compiled;
      const columns = resultColumns(base.query);
      const baseRows = await rows(base);
      if (baseRows.length === 0) throw new Error(`${caseId}: base returned no rows; fixture does not exercise it`);
      for (const spec of VARIANTS) {
        let plan;
        try {
          plan = planVariant(spec, base);
        } catch {
          continue;
        }
        let variantRows: Row[];
        if (plan.hydrate) {
          const first = await rows(plan.statements[0]!);
          const keys = await rows(
            keyOnly(plan.statements[0]!, 'toString(startedAt) AS s, traceId AS t, __dedupeKey AS d'),
          );
          // Local servers reject large form fields (see FINDINGS: querySpans limit 1000); Cloud does not.
          const blobs: Row[] = [];
          for (let i = 0; i < keys.length; i += 200) {
            const chunk = keys
              .slice(i, i + 200)
              .map(k => [String(k.s), String(k.t), String(k.d)] as [string, string, string]);
            blobs.push(...(await rows(plan.hydrate(chunk))));
          }
          const byKey = new Map(blobs.map(b => [`${b.__t}|${b.__d}`, b]));
          variantRows = first.map(r => {
            const b = byKey.get(`${r.traceId}|${r.__dedupeKey}`);
            return { ...r, metadata: b?.__m ?? null, input: b?.__i ?? null };
          });
        } else {
          variantRows = await rows(plan.statements[0]!);
        }
        const same = norm(baseRows, columns) === norm(variantRows, columns);
        // Two-stage variants: prod can only hash the list (without blobs), so cross-check that part here.
        const hashed = plan.hydrate ? columns.filter(c => c !== 'metadata' && c !== 'input') : columns;
        const rowsSame = plan.hydrate ? norm(baseRows, hashed) === norm(variantRows, hashed) : same;
        const hashSame =
          JSON.stringify(await hash(base, hashed)) === JSON.stringify(await hash(plan.statements[0]!, hashed));
        compared++;
        const expected = !contentDiffers || CONTENT_SAFE.has(spec);
        if (rowsSame !== hashSame) {
          failures++;
          log(`✗ ${label} ${caseId} ${spec}: row comparison ${rowsSame} but hash comparison ${hashSame}`);
        } else if (expected && !same) {
          failures++;
          log(`✗ ${label} ${caseId} ${spec}: ${baseRows.length} base rows vs ${variantRows.length}, results differ`);
        } else if (!expected) {
          log(`  ${label} ${caseId} ${spec}: ${same ? 'equal' : 'differs'} (not required with differing copies)`);
        }
      }
    }
    log(`${label}: ${compared} comparisons, ${failures} failures`);
    if (failures) throw new Error(`${label}: ${failures} equivalence failures`);
  };

  try {
    // Exact unmerged copies of 10% of roots, and same-content copies under a second dedupeKey for another 10%.
    await admin.command({ query: `SYSTEM STOP MERGES mastra_trace_roots` });
    await admin.command({
      query: `INSERT INTO mastra_trace_roots SELECT * FROM mastra_trace_roots WHERE cityHash64(traceId) % 10 = 0`,
    });
    await admin.command({
      query: `INSERT INTO mastra_trace_roots SELECT * REPLACE (concat(dedupeKey, '~dup') AS dedupeKey) FROM mastra_trace_roots WHERE cityHash64(traceId) % 10 = 1`,
    });
    const census = await rows({
      query: `SELECT countIf(n > 1) AS multi, countIf(k > 1) AS multiKey FROM (SELECT traceId, count() AS n, uniqExact(dedupeKey) AS k FROM mastra_trace_roots GROUP BY traceId)`,
      query_params: {},
    });
    log(`duplicates loaded: ${JSON.stringify(census[0])}`);
    await pass('identical copies', false);

    // Copies that differ and win the dedupe (smaller dedupeKey) with a different input and environment.
    await admin.command({
      query: `INSERT INTO mastra_trace_roots SELECT * REPLACE (concat('!', dedupeKey) AS dedupeKey, '{"changed":true}' AS input, 'staging' AS environment) FROM mastra_trace_roots WHERE cityHash64(traceId) % 10 = 2`,
    });
    await pass('differing copies', true);
    log('experiment rewrites ✓');
  } finally {
    await admin.close();
    await client.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
