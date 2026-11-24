import { afterEach, describe, expect, it } from 'vitest';

import { migrateOperationalStore } from '../../src/db/migrate.js';
import { purgeExpiredGeoIpCache } from '../../src/db/geoip-cache-operations.js';
import { runRetentionCommand } from '../../src/db/retention-command.js';
import { sweepRetention } from '../../src/db/retention-operations.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
const old = '2026-06-01T00:00:00.000Z';
const authorityOld = '2025-06-01T00:00:00.000Z';
const now = new Date('2026-08-31T00:00:00.000Z');

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

async function seededStore(tenantIds = ['tenant-a', 'tenant-b']) {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
  await migrateOperationalStore(store);
  for (const tenantId of tenantIds) {
    await store.execute({
      sql: `INSERT INTO incidents(id, tenant_id, kind, subject_id, status, created_at, updated_at)
        VALUES (?, ?, 'unknown_device_login', 'subject', 'closed', ?, ?)`,
      args: [`incident-${tenantId}`, tenantId, old, old],
    });
    await store.execute({
      sql: `INSERT INTO evidence_items(
        id, incident_id, tenant_id, source, provider, observed_at, collected_at,
        fact_json, confidence, raw_payload_ref, integrity_hash, sensitivity, incomplete
      ) VALUES (?, ?, ?, 'geoip', 'fake', ?, ?, '{}', 0.7, 'redacted', ?, 'restricted', 0)`,
      args: [`evidence-${tenantId}`, `incident-${tenantId}`, tenantId, old, old, 'a'.repeat(64)],
    });
  }
  await store.execute({
    sql: `INSERT INTO geoip_cache_entries(
      tenant_id, policy_version, key_version, ip_hash, result_json, observed_at, expires_at, purge_after
    ) VALUES ('tenant-a', 2, 'v1', ?, '{"outcome":"known","countryCode":"BR"}', ?, ?, ?)`,
    args: ['b'.repeat(64), old, '2026-06-02T00:00:00.000Z', '2026-06-03T00:00:00.000Z'],
  });
  await store.execute({
    sql: `INSERT INTO dead_letter_events(
      id, source_outbox_id, event_type, event_ref, tenant_id, incident_id, error_code, attempt_count, created_at, resolved_at
    ) VALUES ('dlq-a', NULL, 'test', 'redacted', 'tenant-a', 'incident-tenant-a', 'EVENT_INVALID', 1, ?, ?)`,
    args: [old, old],
  });
  await store.execute({
    sql: `INSERT INTO workflow_runs(id, incident_id, tenant_id, run_id, workflow_id, status, started_at, finished_at, trace_context_json)
      VALUES ('run-a', 'incident-tenant-a', 'tenant-a', 'run-a', 'workflow', 'completed', ?, ?, '{}')`,
    args: [old, old],
  });
  await store.execute({
    sql: `INSERT INTO provider_deliveries(
      id, provider, incident_id, tenant_id, operation, idempotency_key, status, projection_json, observed_at
    ) VALUES ('projection-a', 'mock', 'incident-tenant-a', 'tenant-a', 'create', 'projection-a', 'completed', '{}', ?)`,
    args: [old],
  });
  await store.execute({
    sql: `INSERT INTO timeline_events(
      id, incident_id, tenant_id, sequence, type, category, correlation_id, payload_json, schema_version, occurred_at
    ) VALUES ('timeline-a', 'incident-tenant-a', 'tenant-a', 1, 'retention.test', 'test', 'correlation', '{}', 1, ?)`,
    args: [authorityOld],
  });
  return store;
}

describe('Retention retention sweep', () => {
  it('rejects an overlong tenant before any retention SQL mutation', async () => {
    const store = await seededStore();
    await expect(
      sweepRetention(store, {
        now,
        limit: 1,
        tenantId: 'a'.repeat(129),
        sweepId: 'retention-overlong-tenant',
      }),
    ).rejects.toThrow('RETENTION_TENANT_INVALID');
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_tombstone_claims',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_source_cursors',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('keeps dry-runs non-destructive and scopes a bounded sweep to one tenant', async () => {
    const store = await seededStore();
    const dryRun = await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'tenant-a',
      dryRun: true,
      sweepId: 'retention-dry-run',
    });
    expect(dryRun).toMatchObject({
      dryRun: true,
      scanned: 5,
      deleted: 2,
      minimized: 2,
      retainedAuthority: 1,
    });
    await expect(store.execute({ sql: 'SELECT count(*) AS count FROM evidence_items' })).resolves.toMatchObject({
      rows: [{ count: 2 }],
    });
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_tombstone_claims',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });

    const applied = await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'tenant-a',
      sweepId: 'retention-tenant-a',
    });
    expect(applied).toMatchObject({ dryRun: false, scanned: 5 });
    await expect(
      store.execute({
        sql: 'SELECT tenant_id FROM evidence_items ORDER BY tenant_id',
      }),
    ).resolves.toMatchObject({ rows: [{ tenant_id: 'tenant-b' }] });
    await expect(
      store.execute({
        sql: "SELECT trace_context_json FROM workflow_runs WHERE id='run-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ trace_context_json: null }] });
    await expect(
      store.execute({
        sql: "SELECT projection_json FROM provider_deliveries WHERE id='projection-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ projection_json: null }] });
    await expect(
      store.execute({
        sql: "SELECT id FROM timeline_events WHERE id='timeline-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ id: 'timeline-a' }] });
    await expect(
      store.execute({
        sql: 'SELECT disposition FROM retention_tombstone_claims ORDER BY source',
      }),
    ).resolves.toMatchObject({
      rows: expect.arrayContaining([
        { disposition: 'deleted' },
        { disposition: 'minimized' },
        { disposition: 'retained-authority' },
      ]),
    });
  });

  it('is idempotent under concurrent callers and records an append-only audit', async () => {
    const store = await seededStore();
    const results = await Promise.all([
      sweepRetention(store, {
        now,
        limit: 32,
        tenantId: 'tenant-a',
        sweepId: 'retention-concurrent-a',
      }),
      sweepRetention(store, {
        now,
        limit: 32,
        tenantId: 'tenant-a',
        sweepId: 'retention-concurrent-b',
      }),
    ]);
    expect(results.map(result => result.scanned).sort()).toEqual([0, 5]);
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_tombstone_claims',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 5 }] });
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_audit_events',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('rejects missing, empty and non-canonical tenant boundaries before any SQL', async () => {
    const store = await seededStore(['tenant-a', ' tenant-a ', 'Tenant-A', 'tenant-東京']);
    for (const tenantId of [undefined, '', '   ', ' tenant-a ', 'tenant-a ', '\u00a0tenant-a\u00a0']) {
      await expect(
        sweepRetention(store, {
          now,
          limit: 32,
          ...(tenantId === undefined ? {} : { tenantId }),
        }),
      ).rejects.toThrow('RETENTION_TENANT_INVALID');
    }
    await expect(
      store.execute({
        sql: 'SELECT tenant_id FROM evidence_items ORDER BY tenant_id',
      }),
    ).resolves.toMatchObject({
      rows: [
        { tenant_id: ' tenant-a ' },
        { tenant_id: 'Tenant-A' },
        { tenant_id: 'tenant-a' },
        { tenant_id: 'tenant-東京' },
      ],
    });
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_audit_events',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('uses canonical tenant identity byte-for-byte without case or Unicode normalization', async () => {
    const store = await seededStore(['tenant-a', 'Tenant-A', 'tenant-東京']);
    const wrongCase = await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'tenant-A',
      sweepId: 'retention-wrong-case',
    });
    expect(wrongCase.scanned).toBe(0);
    await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'Tenant-A',
      sweepId: 'retention-uppercase',
    });
    await expect(
      store.execute({
        sql: 'SELECT tenant_id FROM evidence_items ORDER BY tenant_id',
      }),
    ).resolves.toMatchObject({
      rows: [{ tenant_id: 'tenant-a' }, { tenant_id: 'tenant-東京' }],
    });
    await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'tenant-東京',
      sweepId: 'retention-unicode',
    });
    await expect(
      store.execute({
        sql: 'SELECT tenant_id FROM evidence_items ORDER BY tenant_id',
      }),
    ).resolves.toMatchObject({ rows: [{ tenant_id: 'tenant-a' }] });
  });

  it('attributes retention audit to its tenant and retains its 365-day authority', async () => {
    const store = await seededStore();
    await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'tenant-a',
      sweepId: 'retention-audit-origin',
    });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_audit_events WHERE tenant_id = 'tenant-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await store.execute({
      sql: `INSERT INTO retention_audit_events(
        id, sweep_id, tenant_id, event, dry_run, occurred_at, detail_json
      ) VALUES ('unversioned-audit-a', 'unversioned', 'tenant-a', 'completed', 0, ?, '{}'),
        ('unversioned-audit-b', 'unversioned', 'tenant-a', 'completed', 0, ?, '{}')`,
      args: [authorityOld, authorityOld],
    });
    const retained = await sweepRetention(store, {
      now: new Date('2027-09-01T00:00:00.000Z'),
      limit: 32,
      tenantId: 'tenant-a',
      sweepId: 'retention-audit-policy',
    });
    expect(retained).toMatchObject({ retainedAuthority: 3 });
    await expect(
      store.execute({
        sql: `SELECT count(*) AS count FROM retention_tombstone_claims
          WHERE source = 'retention_audit_events'`,
      }),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_audit_events WHERE tenant_id = 'tenant-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
  });

  it('claims expired summaries once and advances a later DLQ with limit one', async () => {
    const store = await seededStore();
    await store.execute({
      sql: "DELETE FROM evidence_items WHERE tenant_id = 'tenant-a'",
    });
    await store.execute({
      sql: 'UPDATE workflow_runs SET trace_context_json = NULL',
    });
    await store.execute({
      sql: 'UPDATE provider_deliveries SET projection_json = NULL',
    });
    await store.execute({
      sql: 'UPDATE timeline_events SET occurred_at = ?',
      args: ['2027-09-01T00:00:00.000Z'],
    });
    await store.execute({
      sql: `INSERT INTO retention_audit_events(
        id, sweep_id, tenant_id, event, dry_run, occurred_at, detail_json
      ) VALUES ('summary-one', 'retention-summary:one', 'tenant-a', 'completed', 0, ?, '{}'),
        ('summary-two', 'retention-summary:two', 'tenant-a', 'completed', 0, ?, '{}')`,
      args: [authorityOld, authorityOld],
    });
    const annualNow = new Date('2027-08-31T00:00:00.000Z');
    const results = [];
    for (const sweepId of ['retention-summary-one', 'retention-dlq', 'retention-summary-two', 'retention-converged'])
      results.push(
        await sweepRetention(store, {
          now: annualNow,
          limit: 1,
          tenantId: 'tenant-a',
          sweepId,
        }),
      );
    expect(results.map(result => result.scanned)).toEqual([1, 1, 1, 0]);
    expect(results[0]).toMatchObject({ retainedAuthority: 1 });
    expect(results[1]).toMatchObject({ deleted: 1 });
    expect(results[2]).toMatchObject({ retainedAuthority: 1 });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM dead_letter_events WHERE id = 'dlq-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
    await expect(
      store.execute({
        sql: `SELECT count(*) AS count FROM retention_tombstone_claims
          WHERE source = 'retention_audit_events'`,
      }),
    ).resolves.toMatchObject({ rows: [{ count: 2 }] });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_audit_events WHERE tenant_id = 'tenant-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 3 }] });
  });

  it('runs the tenant-scoped maintenance command as dry-run by default', async () => {
    const store = await seededStore();
    const result = await runRetentionCommand(['--tenant', 'tenant-a', '--limit', '32'], { store, now: () => now });
    expect(result).toMatchObject({ dryRun: true, scanned: 5 });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM evidence_items WHERE tenant_id='tenant-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('retains terminal consumer effects independently for each tenant', async () => {
    const store = await seededStore();
    await store.execute({
      sql: `INSERT INTO consumer_effect_ledger(
        tenant_id, consumer_group, event_id, status, attempt_count, fence_token, lease_expires_at, completed_at
      ) VALUES
        ('tenant-a', 'incident-worker', 'shared-effect', 'completed', 1, 'fence-a', ?, ?),
        ('tenant-b', 'incident-worker', 'shared-effect', 'dead_lettered', 1, 'fence-b', ?, ?),
        ('tenant-a', 'incident-worker', 'processing-effect', 'processing', 1, 'fence-processing', ?, NULL)`,
      args: [authorityOld, authorityOld, authorityOld, authorityOld, authorityOld],
    });
    const dryRun = await sweepRetention(store, {
      now: new Date('2027-08-31T00:00:00.000Z'),
      limit: 32,
      tenantId: 'tenant-a',
      dryRun: true,
    });
    expect(dryRun.retainedAuthority).toBeGreaterThanOrEqual(1);
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_tombstone_claims WHERE source = 'consumer_effect_ledger'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
    await sweepRetention(store, {
      now: new Date('2027-08-31T00:00:00.000Z'),
      limit: 32,
      tenantId: 'tenant-a',
    });
    await sweepRetention(store, {
      now: new Date('2027-08-31T00:00:00.000Z'),
      limit: 32,
      tenantId: 'tenant-b',
    });
    await expect(
      store.execute({
        sql: `SELECT tenant_id, source_identity FROM retention_tombstone_claims
          WHERE source = 'consumer_effect_ledger' ORDER BY tenant_id`,
      }),
    ).resolves.toMatchObject({
      rows: [
        {
          tenant_id: 'tenant-a',
          source_identity: '["incident-worker","shared-effect"]',
        },
        {
          tenant_id: 'tenant-b',
          source_identity: '["incident-worker","shared-effect"]',
        },
      ],
    });
    await expect(
      store.execute({
        sql: `SELECT tenant_id, event_id, status FROM consumer_effect_ledger
          WHERE consumer_group = 'incident-worker' ORDER BY tenant_id, event_id`,
      }),
    ).resolves.toMatchObject({
      rows: [
        {
          tenant_id: 'tenant-a',
          event_id: 'processing-effect',
          status: 'processing',
        },
        {
          tenant_id: 'tenant-a',
          event_id: 'shared-effect',
          status: 'completed',
        },
        {
          tenant_id: 'tenant-b',
          event_id: 'shared-effect',
          status: 'dead_lettered',
        },
      ],
    });
  });

  it('claims an expired summary exactly once under concurrent callers', async () => {
    const store = await seededStore();
    await store.execute({
      sql: "DELETE FROM evidence_items WHERE tenant_id = 'tenant-a'",
    });
    await store.execute({
      sql: 'UPDATE workflow_runs SET trace_context_json = NULL',
    });
    await store.execute({
      sql: "DELETE FROM dead_letter_events WHERE tenant_id = 'tenant-a'",
    });
    await store.execute({
      sql: 'UPDATE provider_deliveries SET projection_json = NULL',
    });
    await store.execute({
      sql: 'UPDATE timeline_events SET occurred_at = ?',
      args: ['2027-09-01T00:00:00.000Z'],
    });
    await store.execute({
      sql: `INSERT INTO retention_audit_events(
        id, sweep_id, tenant_id, event, dry_run, occurred_at, detail_json
      ) VALUES ('summary-concurrent', 'retention-summary:concurrent', 'tenant-a', 'completed', 0, ?, '{}')`,
      args: [authorityOld],
    });
    const results = await Promise.all([
      sweepRetention(store, {
        now: new Date('2027-08-31T00:00:00.000Z'),
        limit: 1,
        tenantId: 'tenant-a',
      }),
      sweepRetention(store, {
        now: new Date('2027-08-31T00:00:00.000Z'),
        limit: 1,
        tenantId: 'tenant-a',
      }),
    ]);
    expect(results.map(result => result.scanned).sort()).toEqual([0, 1]);
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_tombstone_claims WHERE source = 'retention_audit_events'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_audit_events WHERE tenant_id = 'tenant-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('rolls back a failed expired-summary claim and its source cursor', async () => {
    const store = await seededStore();
    await store.execute({
      sql: "DELETE FROM evidence_items WHERE tenant_id = 'tenant-a'",
    });
    await store.execute({
      sql: `INSERT INTO retention_audit_events(
        id, sweep_id, tenant_id, event, dry_run, occurred_at, detail_json
      ) VALUES ('summary-rollback', 'retention-summary:rollback', 'tenant-a', 'completed', 0, ?, '{}')`,
      args: [authorityOld],
    });
    await store.execute({
      sql: `CREATE TRIGGER abort_retention_summary_claim BEFORE INSERT ON retention_tombstone_claims
        WHEN NEW.source = 'retention_audit_events' BEGIN SELECT RAISE(ABORT, 'forced'); END`,
    });
    await expect(
      sweepRetention(store, {
        now: new Date('2027-08-31T00:00:00.000Z'),
        limit: 1,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('temporarily unavailable');
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_tombstone_claims WHERE source = 'retention_audit_events'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM retention_source_cursors WHERE tenant_id = 'tenant-a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('advances bounded authority batches past pre-existing claims with factual audit counts', async () => {
    const store = await seededStore();
    await store.execute({
      sql: `INSERT INTO timeline_events(
        id, incident_id, tenant_id, sequence, type, category, correlation_id, payload_json, schema_version, occurred_at
      ) VALUES ('timeline-b', 'incident-tenant-a', 'tenant-a', 2, 'retention.test', 'test', 'correlation-b', '{}', 1, ?)`,
      args: [authorityOld],
    });
    const boundary = new Date('2026-06-01T00:00:00.000Z');
    const first = await sweepRetention(store, {
      now: boundary,
      limit: 1,
      tenantId: 'tenant-a',
      sweepId: 'retention-first',
    });
    const second = await sweepRetention(store, {
      now: boundary,
      limit: 1,
      tenantId: 'tenant-a',
      sweepId: 'retention-second',
    });
    const third = await sweepRetention(store, {
      now: boundary,
      limit: 1,
      tenantId: 'tenant-a',
      sweepId: 'retention-third',
    });
    expect(first).toMatchObject({ scanned: 1, retainedAuthority: 1 });
    expect(second).toMatchObject({ scanned: 1, retainedAuthority: 1 });
    expect(third).toMatchObject({
      scanned: 0,
      deleted: 0,
      minimized: 0,
      retainedAuthority: 0,
    });
    await expect(
      store.execute({
        sql: "SELECT source_identity FROM retention_tombstone_claims WHERE source='timeline_events' ORDER BY source_identity",
      }),
    ).resolves.toMatchObject({
      rows: [{ source_identity: '["timeline-a"]' }, { source_identity: '["timeline-b"]' }],
    });
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM retention_audit_events',
      }),
    ).resolves.toMatchObject({ rows: [{ count: 2 }] });
  });

  it('keeps GeoIP under the integration deadline owner and claims long structured identities', async () => {
    const store = await seededStore();
    const longEvidenceId = 'e'.repeat(257);
    const longProviderKey = 'k'.repeat(256);
    await store.execute({
      sql: `INSERT INTO evidence_items(
        id, incident_id, tenant_id, source, provider, observed_at, collected_at,
        fact_json, confidence, raw_payload_ref, integrity_hash, sensitivity, incomplete
      ) VALUES (?, 'incident-tenant-a', 'tenant-a', 'geoip', 'fake', ?, ?, '{}', 0.7, 'redacted', ?, 'restricted', 0)`,
      args: [longEvidenceId, old, old, 'c'.repeat(64)],
    });
    await store.execute({
      sql: `INSERT INTO provider_effect_ledger(
        provider, idempotency_key, tenant_id, incident_id, operation, plan_id, action_id, target_id, status, claimed_at
      ) VALUES ('linear', ?, 'tenant-a', 'incident-tenant-a', 'test', 'plan', 'action', 'target', 'claimed', ?)`,
      args: [longProviderKey, authorityOld],
    });
    await store.execute({
      sql: `INSERT INTO geoip_cache_entries(
        tenant_id, policy_version, key_version, ip_hash, result_json, observed_at, expires_at, purge_after
      ) VALUES ('tenant:a', 2, 'v1', ?, '{"outcome":"known","countryCode":"BR"}', ?, ?, ?)`,
      args: ['d'.repeat(64), '2026-06-01T00:00:00.000Z', '2026-06-02T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    });

    const applied = await sweepRetention(store, {
      now,
      limit: 32,
      tenantId: 'tenant-a',
      sweepId: 'retention-long-identities',
    });
    expect(applied.deleted).toBe(3);
    expect(applied.retainedAuthority).toBe(2);
    await expect(
      store.execute({
        sql: "SELECT source_identity FROM retention_tombstone_claims WHERE source='provider_effect_ledger'",
      }),
    ).resolves.toMatchObject({
      rows: [{ source_identity: JSON.stringify(['linear', longProviderKey]) }],
    });
    await expect(
      store.execute({
        sql: 'SELECT count(*) AS count FROM evidence_items WHERE id = ?',
        args: [longEvidenceId],
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });

    const deadline = new Date('2026-07-01T00:00:00.000Z');
    const before = new Date(deadline.getTime() - 1);
    await sweepRetention(store, {
      now: deadline,
      limit: 32,
      tenantId: 'tenant:a',
      sweepId: 'retention-geoip-delegated',
    });
    await purgeExpiredGeoIpCache(store, before);
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM geoip_cache_entries WHERE tenant_id='tenant:a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await purgeExpiredGeoIpCache(store, deadline);
    await expect(
      store.execute({
        sql: "SELECT count(*) AS count FROM geoip_cache_entries WHERE tenant_id='tenant:a'",
      }),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });
});
