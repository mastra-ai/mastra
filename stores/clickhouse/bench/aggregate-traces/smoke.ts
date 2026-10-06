/**
 * Local end-to-end smoke run against the docker ClickHouse from `stores/clickhouse/docker-compose.yaml`.
 * Never touches the replica: it uses its own hard-coded localhost credentials, not the env file.
 *
 *   docker compose up -d --wait   (in stores/clickhouse)
 *   tsx bench/aggregate-traces/smoke.ts
 *
 * Builds the OSS schema in a scratch database, adds Platform's `projectId` column, loads fixtures
 * for two projects, creates a `readonly = 2` user, then drives preflight, profile and every
 * case/variant/window through the same code paths as the real run.
 */
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@clickhouse/client';
import type { CreateSpanRecord } from '@mastra/core/storage';

import { ObservabilityStorageClickhouseVNext } from '../../src/storage/domains/observability/v-next';
import { anchorTo, CASES, compileCase, timeRangeFor } from './cases';
import { BenchClient, TIERS } from './client';
import { collectMetrics } from './metrics';
import { candidates, discoverLiterals, distribution, gauge, pickProjects, projectHash, projectStats } from './profile';
import type { ProfileContext, Selection, TableColumns } from './profile';
import { preflight, readRecords, RESULTS_DIR, runCases } from './run';
import type { Context } from './run';

const LOCAL = { url: 'http://localhost:8123', username: 'default', password: 'password' };
const DB = 'aqa_bench_smoke';
const RO_USER = 'aqa_bench_smoke_ro';
const RO_PASSWORD = randomUUID();
const ORG = 'smoke-org';
const PROJECTS = { a: 'smoke-proj-a', b: 'smoke-proj-b' };
const SIGNAL_TABLES = [
  'mastra_span_events',
  'mastra_trace_roots',
  'mastra_metric_events',
  'mastra_score_events_current',
  'mastra_feedback_events',
];

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke check failed: ${message}`);
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fixtures(to: Date): { spans: CreateSpanRecord[]; tracesPerProject: Record<string, number> } {
  const spans: CreateSpanRecord[] = [];
  const tracesPerProject: Record<string, number> = { [PROJECTS.a]: 0, [PROJECTS.b]: 0 };
  for (let i = 0; i < 480; i++) {
    const project = i % 3 === 0 ? PROJECTS.b : PROJECTS.a;
    tracesPerProject[project]! += 1;
    const startedAt = new Date(to.getTime() - 60_000 - i * 5 * 60_000);
    const traceId = `trace-${randomUUID()}`;
    const rootSpanId = `span-${randomUUID()}`;
    const base = {
      traceId,
      entityType: 'agent',
      entityId: `agent-${i % 3}`,
      entityName: `Agent ${i % 3}`,
      userId: `user-${i % 7}`,
      organizationId: ORG,
      resourceId: project,
      runId: null,
      sessionId: null,
      threadId: `thread-${i % 11}`,
      requestId: null,
      environment: i % 5 === 0 ? 'staging' : 'production',
      source: 'local',
      serviceName: 'svc',
      scope: null,
      attributes: null,
      tags: null,
      links: null,
      input: null,
      output: null,
      requestContext: null,
      isEvent: false,
    } as const;
    spans.push({
      ...base,
      spanId: rootSpanId,
      parentSpanId: null,
      name: `agent run ${i % 3}`,
      spanType: 'agent_run',
      metadata: { tenant: `tenant-${i % 4}` },
      error: i % 9 === 0 ? { message: 'boom' } : null,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 500 + (i % 13) * 700),
    } as unknown as CreateSpanRecord);
    spans.push({
      ...base,
      spanId: `span-${randomUUID()}`,
      parentSpanId: rootSpanId,
      name: i % 2 ? 'medication_lookup' : 'weather',
      spanType: 'tool_call',
      metadata: null,
      error: null,
      startedAt: new Date(startedAt.getTime() + 100),
      endedAt: new Date(startedAt.getTime() + 400),
    } as unknown as CreateSpanRecord);
  }
  return { spans, tracesPerProject };
}

async function setup(to: Date) {
  const admin = createClient(LOCAL);
  try {
    await admin.command({ query: `DROP DATABASE IF EXISTS ${DB}` });
    await admin.command({ query: `CREATE DATABASE ${DB}` });
    const storage = new ObservabilityStorageClickhouseVNext({ client: createClient({ ...LOCAL, database: DB }) });
    await storage.init();
    for (const table of SIGNAL_TABLES) {
      await admin.command({
        query: `ALTER TABLE ${DB}.${table} ADD COLUMN IF NOT EXISTS projectId Nullable(String) DEFAULT resourceId`,
      });
    }
    const { spans, tracesPerProject } = fixtures(to);
    await storage.batchCreateSpans({ records: spans });
    await admin.command({ query: `DROP USER IF EXISTS ${RO_USER}` });
    await admin.command({ query: `CREATE USER ${RO_USER} IDENTIFIED BY '${RO_PASSWORD}' SETTINGS readonly = 2` });
    await admin.command({ query: `GRANT SELECT ON ${DB}.* TO ${RO_USER}` });
    await admin.command({ query: `GRANT SELECT ON system.* TO ${RO_USER}` });
    return tracesPerProject;
  } finally {
    await admin.close();
  }
}

async function main(): Promise<void> {
  const to = anchorTo(new Date());
  const tracesPerProject = await setup(to);
  log(`fixtures loaded: ${JSON.stringify(tracesPerProject)}`);

  // Preflight must refuse a writable session.
  const writable = new BenchClient({
    origin: LOCAL.url,
    username: LOCAL.username,
    password: LOCAL.password,
    database: DB,
  });
  let refused = false;
  try {
    await preflight(writable, { runId: 'smoke' });
  } catch (error) {
    refused = error instanceof Error && error.message.includes('readonly=0');
  } finally {
    await writable.close();
  }
  check(refused, 'preflight accepts a readonly=0 session');
  log('preflight refuses readonly=0 ✓');
  const optedIn = new BenchClient({
    origin: LOCAL.url,
    username: LOCAL.username,
    password: LOCAL.password,
    database: DB,
  });
  try {
    const pre0 = await preflight(optedIn, { runId: 'smoke', acceptReadonly0: true });
    check(pre0.readonly === 0, 'preflight did not record readonly=0');
  } finally {
    await optedIn.close();
  }
  log('preflight accepts readonly=0 only with the explicit opt-in ✓');

  const client = new BenchClient({ origin: LOCAL.url, username: RO_USER, password: RO_PASSWORD });
  const resultsFile = join(RESULTS_DIR, 'smoke.jsonl');
  rmSync(resultsFile, { force: true });
  try {
    const pre = await preflight(client, { runId: 'smoke' });
    check(pre.readonly === 2 && pre.database === DB, 'preflight did not pass with the readonly=2 user');
    check(pre.queryLog !== 'none', 'query_log not readable');
    check(!Object.keys(pre.missingColumns).length, `missing columns ${JSON.stringify(pre.missingColumns)}`);
    log(`preflight ✓ (query_log: ${pre.queryLog}, skip indexes: ${pre.skipIndexes.length})`);

    const scoped = new BenchClient({ origin: LOCAL.url, username: RO_USER, password: RO_PASSWORD, database: DB });
    const ctx: Context = {
      client: scoped,
      queryLog: 'none',
      runId: 'smoke',
      tier: TIERS[1],
      lastQueryEnd: 0,
      resultsFile,
      pauseMs: 0,
      reps: 2,
      verbose: true,
    };
    const profileCtx: ProfileContext = {
      client: scoped,
      tier: TIERS[1],
      logComment: s => `aqa-bench:smoke:${s}`,
      pause: async () => {},
    };
    const g = await gauge(profileCtx, to);
    const d = await distribution(profileCtx, to);
    check(d.projects === 2 && d.traces === 480, `distribution ${JSON.stringify(d)}`);
    const picked = pickProjects(await candidates(profileCtx, to, d));
    check(picked.length === 2, `picked ${picked.length}`);
    const columns: TableColumns = Object.fromEntries(Object.entries(pre.columns).map(([t, c]) => [t, new Set(c)]));
    const projects = [];
    for (const candidate of picked) {
      const stats = await projectStats(profileCtx, to, candidate, columns);
      const { literals, literalSource } = await discoverLiterals(profileCtx, to, candidate);
      check(literalSource.tool === 'discovered' && literalSource.metadataKey === 'discovered', 'literal discovery');
      projects.push({
        ...candidate,
        hash: projectHash('smoke', candidate),
        representative: true,
        stats,
        literals,
        literalSource,
      });
    }
    log(`profile ✓ (gauge ${g.projects} projects; buckets ${projects.map(p => p.bucket).join(',')})`);

    // Project scoping actually restricts the population.
    const a = projects.find(p => p.projectId === PROJECTS.a)!;
    const f0 = compileCase(
      CASES.find(c => c.id === 'F0')!,
      'base',
      a.literals,
      timeRangeFor({ id: '7d', ms: 7 * 86_400_000 }, to),
      a,
    );
    const counted = await scoped.rows<{ m0: number }>(f0.query, f0.query_params, {
      tier: TIERS[1],
      logComment: 'aqa-bench:smoke:count',
    });
    check(counted.ok, `F0 failed: ${counted.errorMessage}`);
    check(Number(counted.rows![0]!.m0) === tracesPerProject[PROJECTS.a], `F0 counted ${counted.rows![0]!.m0}`);
    log('project scope restricts F0 to one project ✓');

    // max_result_rows must only bound the final result, not the IN-subqueries.
    const f3 = compileCase(
      CASES.find(c => c.id === 'F3')!,
      'base',
      a.literals,
      timeRangeFor({ id: '7d', ms: 7 * 86_400_000 }, to),
      a,
    );
    const bounded = await scoped.discard(f3.query, f3.query_params, {
      tier: { ...TIERS[1], maxResultRows: 2 },
      logComment: 'aqa-bench:smoke:result-rows',
    });
    check(bounded.ok, `max_result_rows=2 broke F3 (${bounded.errorCode}): ${bounded.errorMessage}`);
    log('max_result_rows bounds only the final result ✓');

    // query_log metrics path.
    const metrics = await collectMetrics(scoped, pre.queryLog, bounded, TIERS[1], 'aqa-bench:smoke:metrics', 30_000);
    check(metrics.source === 'query_log' && metrics.readRows > 0, `query_log metrics ${JSON.stringify(metrics)}`);
    log(`query_log metrics ✓ (${metrics.readRows} rows read)`);

    const selection: Selection = {
      version: 1,
      salt: 'smoke',
      database: DB,
      profiledAt: new Date().toISOString(),
      anchorTo: to.toISOString(),
      distribution: d,
      projects,
    };
    await runCases(ctx, selection, {
      buckets: [...new Set(projects.map(p => p.bucket))],
      windows: ['1d', '7d', '30d'],
      gateBApproved: true,
    });
    const records = readRecords(resultsFile);
    const failed = records.filter(r => !r.ok);
    const expected = new Set(CASES.flatMap(def => def.variants.map(v => `${def.id}|${v}`)));
    const seen = new Set(records.map(r => `${r.caseId}|${r.variant}`));
    check(
      [...expected].every(k => seen.has(k)),
      `not every case/variant ran: missing ${[...expected].filter(k => !seen.has(k)).join(', ')}`,
    );
    check(
      records.some(r => r.stage === 'payload-scoped'),
      'payload stage did not run',
    );
    check(failed.length === 0, `${failed.length} failed executions`);
    log(`all ${records.length} executions across ${seen.size} case/variants succeeded ✓`);
    await scoped.close();
  } finally {
    await client.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
