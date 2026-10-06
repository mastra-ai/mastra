/**
 * Local end-to-end smoke run against the docker ClickHouse from `stores/clickhouse/docker-compose.yaml`.
 * Never touches the replica: it uses hard-coded localhost credentials, not the env file.
 *
 *   docker compose up -d --wait   (in stores/clickhouse)
 *   tsx bench/trace-query/smoke.ts
 *
 * Builds the OSS schema (with the delta tables) in a scratch database, adds Platform's `projectId`
 * column, loads spans, cost metrics and feedback for two projects, creates a `readonly = 2` user,
 * then drives preflight, capacity, sidecar discovery, the concurrency probe and every case/stage
 * (with sentinels) through the same code paths as the real run.
 */
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@clickhouse/client';
import type { CreateFeedbackRecord, CreateSpanRecord, MetricRecord } from '@mastra/core/storage';

import { ObservabilityStorageClickhouseVNext } from '../../src/storage/domains/observability/v-next';
import { BenchClient, TIERS } from '../shared/client';
import { Pool } from '../shared/pool';
import type { SelectedProject, Selection } from '../shared/profile';
import { preflight, readRecords } from '../shared/runner';
import { CASES, caseById, compileCase, timeRangeFor, WINDOWS } from './cases';
import { discoverSidecar, literalsFor } from './discover';
import { renderReport } from './report';
import { capacityCheck, DELTA_TABLE, files, REQUIRED_COLUMNS, runPhases, runProbe, TABLES } from './run';
import type { SkipRecord, TqContext, TqRecord } from './run';

const LOCAL = { url: 'http://localhost:8123', username: 'default', password: 'password' };
const DB = 'aqa_bench_tq_smoke';
const RO_USER = 'aqa_bench_tq_smoke_ro';
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
const RESULTS = join(import.meta.dirname, 'results', 'smoke');

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke check failed: ${message}`);
}

const log = (message: string) => process.stdout.write(`${message}\n`);

function fixtures(to: Date) {
  const spans: CreateSpanRecord[] = [];
  const metrics: MetricRecord[] = [];
  const feedback: CreateFeedbackRecord[] = [];
  const traces: Record<string, number> = { [PROJECTS.a]: 0, [PROJECTS.b]: 0 };
  for (let i = 0; i < 1800; i++) {
    const project = i % 6 === 0 ? PROJECTS.b : PROJECTS.a;
    traces[project]! += 1;
    const startedAt = new Date(to.getTime() - 60_000 - i * 2 * 60_000);
    const traceId = `trace-${randomUUID()}`;
    const rootSpanId = `span-${randomUUID()}`;
    const modelSpanId = `span-${randomUUID()}`;
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
      threadId: `thread-${i}`,
      requestId: null,
      environment: i % 5 === 0 ? 'staging' : 'production',
      source: 'local',
      serviceName: 'svc',
      scope: null,
      links: null,
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
      attributes: null,
      tags: i % 4 === 0 ? ['vip', 'beta'] : ['beta'],
      input: { prompt: `hello ${i}` },
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
      attributes: null,
      tags: null,
      input: null,
      metadata: null,
      error: i % 11 === 0 ? { message: 'tool failed' } : null,
      startedAt: new Date(startedAt.getTime() + 100),
      endedAt: new Date(startedAt.getTime() + 400),
    } as unknown as CreateSpanRecord);
    spans.push({
      ...base,
      spanId: modelSpanId,
      parentSpanId: rootSpanId,
      name: 'llm',
      spanType: 'model_generation',
      attributes: { model: i % 3 ? 'gpt-4o' : 'gpt-4o-mini', provider: 'openai' },
      tags: null,
      input: null,
      metadata: null,
      error: null,
      startedAt: new Date(startedAt.getTime() + 150),
      endedAt: new Date(startedAt.getTime() + 350),
    } as unknown as CreateSpanRecord);
    metrics.push({
      metricId: `metric-${randomUUID()}`,
      timestamp: new Date(startedAt.getTime() + 350),
      name: 'mastra_model_total_input_tokens',
      value: 100 + i,
      traceId,
      spanId: modelSpanId,
      organizationId: ORG,
      resourceId: project,
      provider: 'openai',
      model: 'gpt-4o',
      estimatedCost: 0.001,
      costUnit: 'usd',
      labels: {},
    } as unknown as MetricRecord);
    if (i % 10 === 0) {
      feedback.push({
        feedbackId: `fb-${randomUUID()}`,
        timestamp: new Date(startedAt.getTime() + 1_000),
        traceId,
        spanId: rootSpanId,
        feedbackSource: 'user',
        feedbackType: i % 20 === 0 ? 'thumbs' : 'rating',
        value: 1,
        organizationId: ORG,
        resourceId: project,
      } as unknown as CreateFeedbackRecord);
    }
  }
  return { spans, metrics, feedback, traces };
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
    const { spans, metrics, feedback, traces } = fixtures(to);
    await storage.batchCreateSpans({ records: spans });
    await storage.batchCreateMetrics({ metrics } as never);
    await storage.batchCreateFeedback({ feedbacks: feedback } as never);
    await admin.command({ query: `DROP USER IF EXISTS ${RO_USER}` });
    await admin.command({ query: `CREATE USER ${RO_USER} IDENTIFIED BY '${RO_PASSWORD}' SETTINGS readonly = 2` });
    await admin.command({ query: `GRANT SELECT ON ${DB}.* TO ${RO_USER}` });
    await admin.command({ query: `GRANT SELECT ON system.* TO ${RO_USER}` });
    return traces;
  } finally {
    await admin.close();
  }
}

async function main(): Promise<void> {
  const to = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 + 3_600_000);
  const traces = await setup(to);
  log(`fixtures loaded: ${JSON.stringify(traces)}`);
  rmSync(RESULTS, { recursive: true, force: true });

  const client = new BenchClient({ origin: LOCAL.url, username: RO_USER, password: RO_PASSWORD, database: DB }, 2);
  try {
    const pre = await preflight(client, { runId: 'smoke' }, { tables: TABLES, requiredColumns: REQUIRED_COLUMNS });
    check(pre.readonly === 2 && pre.database === DB, 'preflight did not pass with the readonly=2 user');
    check(!Object.keys(pre.missingColumns).length, `missing columns ${JSON.stringify(pre.missingColumns)}`);
    check(!pre.missingTables.includes(DELTA_TABLE), 'delta table missing');
    log('preflight ✓ (delta table present, required columns present)');

    const capacity = await capacityCheck(client, 'smoke', TIERS[1]);
    log(
      `capacity ✓ (cores ${capacity.cpuCores}, readable ${JSON.stringify(capacity.readable)}, max concurrency ${capacity.maxConcurrency})`,
    );

    const project = (bucket: 'small' | 'mid', id: string): SelectedProject =>
      ({
        bucket,
        organizationId: ORG,
        projectId: id,
        hash: id.slice(-6),
        representative: true,
        stats: { traces30d: traces[id]! },
        literals: { environment: 'production', tool: 'medication_lookup', metadataKey: 'tenant', entityType: 'agent' },
        literalSource: {
          environment: 'discovered',
          tool: 'discovered',
          metadataKey: 'discovered',
          entityType: 'discovered',
        },
      }) as unknown as SelectedProject;
    const selection = {
      version: 1,
      salt: 'smoke',
      database: DB,
      profiledAt: new Date().toISOString(),
      anchorTo: to.toISOString(),
      projects: [project('mid', PROJECTS.a), project('small', PROJECTS.b)],
    } as unknown as Selection;

    const sidecar = await discoverSidecar(
      { client, tier: TIERS[1], logComment: s => `aqa-bench:smoke:${s}`, pause: async () => {} },
      selection,
    );
    const la = literalsFor(selection.projects[0]!, sidecar);
    check(
      la.tag === 'beta' &&
        la.model === 'gpt-4o' &&
        la.metadataValue?.startsWith('tenant-') &&
        la.entityName &&
        la.feedbackType === 'rating',
      `sidecar ${JSON.stringify(la)}`,
    );
    log('sidecar discovery ✓');

    // Project scope restricts the population: K1 (limit 1000, 30d) on project b returns exactly its traces.
    const b = selection.projects[1]!;
    const k1 = compileCase(caseById('K1'), 'base', literalsFor(b, sidecar), timeRangeFor(WINDOWS['30d'], to), b);
    const counted = await client.rows<{ traceId: string }>(
      `SELECT traceId FROM (${k1.compiled.query})`,
      k1.compiled.query_params,
      {
        tier: TIERS[1],
        logComment: 'aqa-bench:smoke:count',
      },
    );
    check(counted.ok && counted.rows!.length === traces[PROJECTS.b], `K1 returned ${counted.rows?.length}`);
    log('project scope restricts K1 to one project ✓');

    const fast = (concurrency: number) =>
      new Pool({ concurrency, pauseMs: 0, startGapMs: 5, overloadPauseMs: 1_000, log });
    const ctx: TqContext = {
      client,
      pool: fast(2),
      queryLog: 'none',
      runId: 'smoke',
      tier: TIERS[1],
      anchorTo: selection.anchorTo,
      sidecar,
      resultsDir: RESULTS,
      reps: 2,
      verbose: true,
      newPool: fast,
    };

    const decision = await runProbe(ctx, selection, [2], { buckets: ['small', 'mid'], windows: ['1d'] });
    const probe = readRecords<TqRecord>(files(RESULTS).probe);
    check(
      probe.some(r => r.arm === 'A') && probe.some(r => r.arm === 'B' && r.inFlight > 1),
      'probe arms did not both run (B concurrently)',
    );
    check(
      probe.filter(r => r.arm === 'A').every(r => r.inFlight === 1 && r.exclusive),
      'arm A was not sequential',
    );
    check(
      probe.every(r => r.ok),
      'probe failures',
    );
    log(`probe ✓ (${probe.length} executions; local decision level ${decision.level}, not meaningful on a laptop)`);

    await runPhases(
      ctx,
      selection,
      { buckets: ['small', 'mid'], windows: ['1d', '7d', '30d'], gateBApproved: true, deltaAvailable: true },
      { ...decision, level: 2, coldAlone: false },
    );
    const runs = readRecords<TqRecord>(files(RESULTS).runs);
    const skips = readRecords<SkipRecord>(files(RESULTS).skips);
    const counted2 = runs.filter(r => r.mode === 'run');
    // Store finding (reproduced with the store's own querySpans()): hydrating ~1000 spans sends one
    // array parameter above ClickHouse's default http_max_field_value_size, before the query runs.
    const tooLarge = (r: TqRecord) =>
      r.caseId === 'S7' && r.stage.startsWith('span-') && r.errorCategory === 'request_size';
    check(runs.some(tooLarge), 'S7 hydration no longer hits the HTTP field limit; update FINDINGS and this check');
    const failed = runs.filter(r => !r.ok && !tooLarge(r));
    for (const def of CASES) {
      check(
        counted2.some(r => r.caseId === def.id) || skips.some(s => s.caseId === def.id),
        `case ${def.id} neither ran nor was recorded as skipped`,
      );
      for (const stage of def.stages) {
        if (def.id === 'P2' && stage !== 'main') continue; // offset 10 000 is past the fixture: empty page
        if (def.id === 'K3' || def.id === 'S9' || def.id === 'D2') continue; // depth beyond the fixture
        check(
          counted2.some(r => r.caseId === def.id && r.stage === stage),
          `${def.id} stage ${stage} did not run`,
        );
      }
    }
    for (const deep of ['K2', 'S8', 'TH6'])
      check(
        counted2.some(r => r.caseId === deep && r.bucket === 'mid'),
        `${deep} did not reach depth 1000`,
      );
    for (const shallow of ['K3', 'S9'])
      check(
        skips.some(s => s.caseId === shallow && s.reason.startsWith('fewer than')),
        `${shallow} not skipped`,
      );
    check(
      counted2.some(r => r.inFlight > 1),
      'counted run never ran concurrently',
    );
    check(
      runs.some(r => r.mode === 'sentinel' && r.exclusive && r.inFlight === 1),
      'no sequential sentinels',
    );
    check(
      failed.length === 0,
      `${failed.length} failed executions: ${[...new Set(failed.map(r => `${r.caseId}:${r.stage}:${r.errorCode}`))].join(', ')}`,
    );
    log(
      `all ${runs.length} executions succeeded across ${new Set(counted2.map(r => r.caseId)).size} cases (${skips.length} recorded skips) ✓`,
    );

    const md = renderReport(runs, probe, skips, new Set());
    check(md.includes('### querySpans()') && md.includes('#### Concurrency 2 vs sequential'), 'report did not render');
    log('report renders ✓');
  } finally {
    await client.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
