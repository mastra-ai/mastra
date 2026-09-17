import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DuckDbAnalyticsStore } from '../../src/analytics/duckdb-store.js';
import { exportAnalytics, type Observation } from '../../src/analytics/store.js';
import { analyticsReport } from '../../src/analytics/report.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';
import type { OperationalStore } from '../../src/db/operational-store.js';

const databases: TempDatabase[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.cleanup();
});
const time = '2026-09-05T00:00:00.000Z';
async function seed(store: OperationalStore, tenant: string) {
  await store.execute({
    sql: `INSERT INTO incidents(id,tenant_id,kind,subject_id,status,created_at,updated_at) VALUES (?,?,'unknown_device_login','SECRET_SUBJECT','investigating',?,?)`,
    args: [tenant, tenant, time, time],
  });
  await store.execute({
    sql: `INSERT INTO workflow_runs(id,incident_id,tenant_id,run_id,workflow_id,status,started_at) VALUES (?,?,?,?,'security','running',?)`,
    args: [tenant, tenant, tenant, tenant, time],
  });
}
const observation = (sequence: number, overrides: Partial<Observation> = {}): Observation => ({
  sequence,
  tenant_id: 'a',
  incident_id: 'a',
  kind: 'workflow',
  entity_id: 'run',
  status: 'running',
  started_at: time,
  finished_at: null,
  triaged: 0,
  trace_present: 0,
  observed_at: time,
  ...overrides,
});

describe('embedded analytics', () => {
  it('runs the explicit-path CLI without reading ambient database configuration', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      await seed(store, 'a');
    } finally {
      store.close();
    }
    const input = fileURLToPath(database.url);
    const before = await readFile(input);
    const output = join(database.directory, 'report.json');
    const args = [
      '--import',
      'tsx',
      'scripts/analytics-report.ts',
      '--input',
      input,
      '--analytics',
      join(database.directory, 'cli.duckdb'),
      '--output',
      output,
      '--tenant',
      'a',
    ];
    await promisify(execFile)(process.execPath, args, {
      env: {
        ...process.env,
        DATABASE_URL: 'file:/do-not-open.db',
        TURSO_DATABASE_URL: 'https://invalid.example',
      },
    });
    const report = JSON.parse(await readFile(output, 'utf8')) as {
      tenantId: string;
      export: { exported: number };
    };
    expect(report.tenantId).toBe('a');
    expect(report.export.exported).toBe(1);
    expect(await readFile(input)).toEqual(before);
    await expect(promisify(execFile)(process.execPath, args)).rejects.toThrow();
  });
  it('migrates an existing database without fabricating historical timings, exports incremental rows and rebuilds', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const analytics = await DuckDbAnalyticsStore.open(join(database.directory, 'analytics.duckdb'));
    const rebuilt = await DuckDbAnalyticsStore.open(join(database.directory, 'rebuilt.duckdb'));
    try {
      await migrateOperationalStore(store, {
        migrationSet: migrations.slice(0, 4),
      });
      await seed(store, 'a');
      await migrateOperationalStore(store);
      await seed(store, 'b');
      await store.execute({
        sql: "UPDATE workflow_runs SET triage_result_json = ? WHERE tenant_id = 'a'",
        args: [JSON.stringify({ secret: 'TOKEN_RAW_EVIDENCE' })],
      });
      const result = await exportAnalytics(store, analytics, 'a');
      expect(result.exported).toBe(2);
      const rows = await analytics.observations(result.sourceId, 'a');
      expect(rows[0]!.observed_at).toBeNull();
      expect(JSON.stringify(rows)).not.toMatch(/SECRET_SUBJECT|TOKEN_RAW_EVIDENCE|secret/);
      expect(analyticsReport('a', rows).triageLatencyMs.status).toBe('NO_DATA');
      expect((await exportAnalytics(store, analytics, 'a')).exported).toBe(0);
      await exportAnalytics(store, rebuilt, 'a');
      expect(await rebuilt.observations(result.sourceId, 'a')).toEqual(rows);
      expect(await analytics.observations(result.sourceId, 'b')).toEqual([]);
      await expect(store.execute({ sql: "UPDATE analytics_journal SET status='oops'" })).rejects.toThrow();
      await expect(store.execute({ sql: 'DELETE FROM analytics_journal' })).rejects.toThrow();
      const before = (
        await store.execute({
          sql: 'SELECT count(*) AS count FROM analytics_journal',
        })
      ).rows[0]!.count;
      await expect(
        store.transaction(async tx => {
          await tx.execute({
            sql: "UPDATE workflow_runs SET status='failed' WHERE tenant_id='a'",
          });
          throw new Error('rollback');
        }),
      ).rejects.toThrow();
      expect(
        (
          await store.execute({
            sql: 'SELECT count(*) AS count FROM analytics_journal',
          })
        ).rows[0]!.count,
      ).toBe(before);
    } finally {
      analytics.close();
      rebuilt.close();
      store.close();
    }
  });

  it('commits rows and cursor together and rejects stale or cross-tenant append', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    let analytics = await DuckDbAnalyticsStore.open(join(database.directory, 'analytics.duckdb'));
    try {
      await analytics.append('source', 'a', 0, [observation(1)]);
      await expect(analytics.append('source', 'a', 0, [observation(2)])).rejects.toThrow('CURSOR_CONFLICT');
      await expect(analytics.append('source', 'a', 1, [observation(2, { tenant_id: 'b' })])).rejects.toThrow(
        'SCOPE_OR_ORDER',
      );
      expect(await analytics.cursor('source', 'a')).toBe(1);
      expect((await analytics.observations('source', 'a')).length).toBe(1);
      await analytics.append('other-source', 'a', 0, [observation(1)]);
      analytics.close();
      analytics = await DuckDbAnalyticsStore.open(join(database.directory, 'analytics.duckdb'));
      expect(await analytics.cursor('source', 'a')).toBe(1);
    } finally {
      analytics.close();
    }
  });

  it('uses committed source gaps and reviewed labels without claiming full trace completeness', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const analytics = await DuckDbAnalyticsStore.open(join(database.directory, 'analytics.duckdb'));
    try {
      await migrateOperationalStore(store);
      await seed(store, 'a');
      await store.execute({
        sql: `INSERT INTO timeline_events(id,incident_id,tenant_id,sequence,type,category,correlation_id,payload_json,schema_version,occurred_at) VALUES ('cor','a','a',1,'evidence.correlated','domain','cor',?,1,?)`,
        args: [
          JSON.stringify({
            secret: 'RAW_TOKEN',
            missingData: [
              { source: 'identity', reason: 'TIMEOUT' },
              { source: 'cloud', reason: 'partial' },
            ],
          }),
          time,
        ],
      });
      const result = await exportAnalytics(store, analytics, 'a');
      const rows = await analytics.observations(result.sourceId, 'a');
      expect(analyticsReport('a', rows).investigationSourceGaps).toBe(2);
      expect(analyticsReport('a', rows).investigationSourceFailureRate.value).toBe(1 / 3);
      expect(analyticsReport('a', rows).traceCompleteness.status).toBe('NO_DATA');
      expect(JSON.stringify(rows)).not.toContain('RAW_TOKEN');
      expect(analyticsReport('a', rows).escalationAccuracy.status).toBe('NO_DATA');
      expect(
        analyticsReport('a', rows, [
          {
            tenantId: 'a',
            incidentId: 'a',
            actualEscalated: true,
            expectedEscalated: false,
            reviewedBy: 'human',
            reviewedAt: time,
          },
        ]).escalationAccuracy.value,
      ).toBe(0);
      expect(() => analyticsReport('b', rows)).toThrow('TENANT_MISMATCH');
      expect(analyticsReport('a', []).traceCompleteness.status).toBe('NO_DATA');
    } finally {
      analytics.close();
      store.close();
    }
  });

  it('calculates known durations and approval outcomes', () => {
    const blockedReport = analyticsReport('a', [observation(1, { kind: 'containment', status: 'blocked' })]);
    expect(blockedReport.containmentBlocked).toBe(1);
    expect(blockedReport.containmentFailureRate.status).toBe('NO_DATA');
    const rows = [
      observation(1),
      observation(2, { triaged: 1, observed_at: '2026-09-05T00:00:03.000Z' }),
      observation(3, {
        kind: 'approval',
        entity_id: 'approval',
        status: 'approved',
        finished_at: '2026-09-05T00:00:05.000Z',
      }),
    ];
    expect(analyticsReport('a', rows).triageLatencyMs.value).toBe(3000);
    expect(analyticsReport('a', rows).approvalLatencyMs.value).toBe(5000);
    expect(analyticsReport('a', rows).approvalOutcomes.approved).toBe(1);
  });
});
