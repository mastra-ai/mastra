/**
 * QX22 (lab only): insert cost of a `MATERIALIZED` input-preview column on the trace-roots table.
 *
 * Two copies of Platform's span → roots pipeline in `tq_lab` (span table + `mastra_mv_trace_roots`-style view
 * into a roots table); B's roots table has `inputPreview MATERIALIZED previewSql(input)`. The same span batches,
 * with message-shaped JSON inputs on root spans, go into both in alternating order. Costs come from
 * `system.query_log`. A second pass inserts only the root rows into the two roots tables directly, which isolates
 * the expression from the rest of the span insert.
 *
 *   tsx bench/trace-query/preview-insert.lab.ts [--batches 12] [--size 10000]
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { createClient } from '@clickhouse/client';

import { previewSql } from './preview-sql';

const LOCK = '/tmp/aqa-bench-lab.lock';
const DB = 'tq_lab';
const OUT = join(import.meta.dirname, 'results', 'qx22.jsonl');

/** Raw byte counts per message (base64 makes each ×4/3); "typical" lands near the 6 KiB prod average. */
const PROFILES = {
  typical: [2200, 800, 1100, 400],
  large: [44000, 16000, 22000, 8000],
} as const;

const ROOT_COLUMNS = `dedupeKey, traceId, spanId, parentSpanId, experimentId, entityType, entityId, entityName,
  entityVersionId, parentEntityType, parentEntityId, parentEntityName, parentEntityVersionId, rootEntityType,
  rootEntityId, rootEntityName, rootEntityVersionId, userId, organizationId, resourceId, product, runId, sessionId,
  threadId, requestId, environment, executionSource, serviceName, name, spanType, isEvent, startedAt, endedAt, tags,
  metadataSearch, attributes, scope, links, input, output, error, metadataRaw, requestContext, projectId`;

function messageJson([system, user, assistant, last]: readonly number[]): string {
  const s = (n: number) => `base64Encode(randomString(${n}))`;
  return `concat('{"messages":[{"role":"system","content":"', ${s(system!)},
    '"},{"role":"user","content":[{"type":"text","text":"', ${s(user!)},
    '"}]},{"role":"assistant","content":"', ${s(assistant!)}, '"},{"role":"user","content":"', ${s(last!)}, '"}]}')`;
}

async function main() {
  const { values } = parseArgs({
    options: { batches: { type: 'string', default: '12' }, size: { type: 'string', default: '10000' } },
  });
  if (!readFileSync(LOCK, 'utf8').includes('owner=trace-query-bench')) throw new Error(`${LOCK} not held by us`);
  const batches = Number(values.batches);
  const size = Number(values.size);
  const client = createClient({
    url: 'http://localhost:18123',
    username: 'default',
    password: 'lab',
    database: DB,
    request_timeout: 600_000,
    clickhouse_settings: { max_threads: 2, max_insert_threads: '1', max_memory_usage: '1500000000' },
  });
  const run = (query: string) => client.command({ query });
  const ids: { id: string; profile: string; pass: string; arm: string; batch: number }[] = [];
  try {
    for (const arm of ['a', 'b']) {
      await run(`DROP VIEW IF EXISTS qx22_mv_${arm}`);
      await run(`DROP TABLE IF EXISTS qx22_spans_${arm}`);
      await run(`DROP TABLE IF EXISTS qx22_roots_${arm}`);
      await run(`CREATE TABLE qx22_spans_${arm} AS mastra_span_events`);
      await run(`CREATE TABLE qx22_roots_${arm} AS mastra_trace_roots`);
      await run(`ALTER TABLE qx22_roots_${arm} DROP COLUMN inputPreview`);
      if (arm === 'b') {
        await run(
          `ALTER TABLE qx22_roots_b ADD COLUMN inputPreview Nullable(String) MATERIALIZED ${previewSql('input')}`,
        );
      }
      await run(`CREATE MATERIALIZED VIEW qx22_mv_${arm} TO qx22_roots_${arm} AS
        SELECT ${ROOT_COLUMNS} FROM qx22_spans_${arm} WHERE parentSpanId IS NULL`);
    }

    // Source batches: real lab spans from four days of the largest project (real root share); roots get message JSON.
    await run(`DROP TABLE IF EXISTS qx22_src`);
    await run(`CREATE TABLE qx22_src ENGINE = MergeTree ORDER BY (profile, batch)
      AS SELECT '' AS profile, toUInt32(0) AS batch, * FROM mastra_span_events LIMIT 0`);
    for (const [profile, sizes] of Object.entries(PROFILES)) {
      for (let batch = 0; batch < batches; batch++) {
        await client.command({
          query: `INSERT INTO qx22_src SELECT '${profile}', toUInt32(${batch}),
              * REPLACE (if(parentSpanId IS NULL, ${messageJson(sizes)}, input) AS input)
            FROM (SELECT * FROM mastra_span_events
              WHERE organizationId = 'lab-org-14' AND endedAt >= '2026-09-29' AND endedAt < '2026-10-03'
              ORDER BY traceId, spanId LIMIT ${size} OFFSET ${batch * size})`,
          clickhouse_settings: { max_threads: 1, max_block_size: '256', max_memory_usage: '3000000000' },
        });
      }
    }
    const shape = await client.query({
      query: `SELECT profile, countIf(parentSpanId IS NULL) AS roots, count() AS spans,
          round(avgIf(length(input), parentSpanId IS NULL)) AS rootInputBytes
        FROM qx22_src GROUP BY profile ORDER BY profile`,
      format: 'JSONEachRow',
    });
    console.log('source', JSON.stringify(await shape.json()));

    const insert = async (profile: string, pass: string, arm: string, batch: number, query: string) => {
      const id = randomUUID();
      await client.command({ query, query_id: id });
      ids.push({ id, profile, pass, arm, batch });
    };
    for (const profile of Object.keys(PROFILES)) {
      for (let batch = 0; batch < batches; batch++) {
        const order = batch % 2 ? ['b', 'a'] : ['a', 'b'];
        for (const arm of order) {
          await insert(
            profile,
            'spans',
            arm,
            batch,
            `INSERT INTO qx22_spans_${arm}
            SELECT * EXCEPT (profile, batch) FROM qx22_src WHERE profile = '${profile}' AND batch = ${batch}`,
          );
        }
        for (const arm of order) {
          await insert(
            profile,
            'roots',
            arm,
            batch,
            `INSERT INTO qx22_roots_${arm} (${ROOT_COLUMNS})
            SELECT ${ROOT_COLUMNS} FROM qx22_src
            WHERE profile = '${profile}' AND batch = ${batch} AND parentSpanId IS NULL`,
          );
        }
      }
    }

    await run('SYSTEM FLUSH LOGS');
    const log = await client.query({
      query: `SELECT query_id, query_duration_ms AS ms, ProfileEvents['UserTimeMicroseconds'] AS userUs,
          ProfileEvents['SystemTimeMicroseconds'] AS sysUs, memory_usage AS memory, written_bytes AS written
        FROM system.query_log WHERE type = 'QueryFinish' AND query_id IN {ids:Array(String)}`,
      query_params: { ids: ids.map(i => i.id) },
      format: 'JSONEachRow',
    });
    const byId = new Map(((await log.json()) as Record<string, string>[]).map(r => [r.query_id, r]));
    const rows = ids.map(i => ({ ...i, ...byId.get(i.id) }));
    for (const r of rows) appendFileSync(OUT, `${JSON.stringify({ exp: 'QX22', env: 'lab', ...r })}\n`);

    const median = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)]!;
    for (const profile of Object.keys(PROFILES)) {
      for (const pass of ['spans', 'roots']) {
        const pick = (arm: string, key: string) =>
          median(
            rows
              .filter(r => r.profile === profile && r.pass === pass && r.arm === arm)
              .map(r => Number((r as never)[key])),
          );
        const line = ['ms', 'userUs', 'memory'].map(k => `${k} ${pick('a', k)} → ${pick('b', k)}`);
        console.log(`${profile} ${pass}: ${line.join(' | ')}`);
      }
    }
    const check = await client.query({
      query: `SELECT count() AS roots, countIf(inputPreview IS NOT NULL) AS withPreview,
          countIf(lengthUTF8(inputPreview) = 101) AS cut, any(substring(inputPreview, 1, 40)) AS sample
        FROM qx22_roots_b`,
      format: 'JSONEachRow',
    });
    console.log('preview', JSON.stringify(await check.json()));
    const sizes = await client.query({
      query: `SELECT table, formatReadableSize(sum(data_compressed_bytes)) AS compressed FROM system.columns
        WHERE database = '${DB}' AND table LIKE 'qx22_roots_%' GROUP BY table ORDER BY table`,
      format: 'JSONEachRow',
    });
    console.log('roots size', JSON.stringify(await sizes.json()));
  } finally {
    await client.close();
  }
}

void main();
