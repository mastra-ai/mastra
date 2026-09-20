import { afterEach, describe, expect, it } from 'vitest';

import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { persistEvidenceItems, readVerifiedEvidence } from '../../src/evidence/persistence.js';
import { CorrelationSchema } from '../../src/evidence/contracts.js';
import { appendCorrelationTimeline } from '../../src/evidence/correlation-timeline.js';
import { LocalIdentityEvidenceProvider } from '../../src/providers/identity-evidence-provider.js';
import { evidenceCollectedAt, seedInvestigationInvestigation } from '../fixtures/evidence.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('evidence collection evidence persistence', () => {
  it('reads back integrity-verified policy-v1 GeoIP evidence', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const { context } = await seedInvestigationInvestigation(store);
    const persisted = await persistEvidenceItems(
      store,
      {
        context,
        source: 'identity',
        provider: 'identity-geoip',
        facts: [
          {
            semanticKey: 'login.country',
            observedAt: context.occurredAt,
            factType: 'login.country',
            value: 'BR',
            confidence: 0.7,
            confidenceProvenance: 'policy-v1',
            rawPayloadRef: 'protected:test:geoip-country',
            sensitivity: 'internal',
            incomplete: false,
          },
        ],
      },
      {
        clock: fixedClock(evidenceCollectedAt),
        ids: sequenceIdGenerator(['geoip-timeline', 'geoip-outbox']),
      },
    );

    await expect(readVerifiedEvidence(store, context, [persisted[0]!.evidenceId])).resolves.toEqual(persisted);
    store.close();
  });

  it('creates evidence records with the current integrity hash version', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    await store.execute({
      sql: `INSERT INTO incidents(
        id, tenant_id, kind, subject_id, status, created_at, updated_at
      ) VALUES (?, ?, 'unknown_device_login', ?, 'investigating', ?, ?)`,
      args: [
        'incident-upgrade',
        'tenant-upgrade',
        'subject-upgrade',
        '2026-08-27T12:00:00.000Z',
        '2026-08-27T12:00:00.000Z',
      ],
    });
    await store.execute({
      sql: `INSERT INTO evidence_items(
        id, incident_id, tenant_id, source, provider, observed_at, collected_at,
        fact_json, confidence, raw_payload_ref, integrity_hash, sensitivity,
        incomplete, error_code, hash_version
      ) VALUES (?, ?, ?, 'identity', 'local-identity', ?, ?, '{}', 1, ?, ?, 'internal', 0, NULL, 1)`,
      args: [
        'evidence-upgrade',
        'incident-upgrade',
        'tenant-upgrade',
        '2026-08-27T12:00:00.000Z',
        '2026-08-27T12:00:00.000Z',
        'protected:reference:evidence',
        'a'.repeat(64),
      ],
    });
    const row = await store.execute({
      sql: 'SELECT hash_version FROM evidence_items WHERE id = ?',
      args: ['evidence-upgrade'],
    });
    expect(row.rows).toEqual([{ hash_version: 1 }]);
    store.close();
  });

  it('uses insert-or-verify for retry and rejects semantic divergence', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const { context } = await seedInvestigationInvestigation(store);
    const provider = new LocalIdentityEvidenceProvider();
    const result = await provider.inspect(
      {
        tenantId: context.tenantId,
        incidentId: context.incidentId,
        subjectId: context.subjectId,
        workflowRunId: context.workflowRunId,
        incidentKind: context.incidentKind,
        occurredAt: context.occurredAt,
      },
      { signal: new AbortController().signal, attempt: 1 },
    );
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('fixture failed');
    const input = {
      context,
      source: 'identity' as const,
      provider: result.provider,
      facts: result.facts,
    };
    const first = await persistEvidenceItems(store, input, {
      ids: sequenceIdGenerator([
        'evidence-timeline-1',
        'evidence-outbox-1',
        'evidence-timeline-2',
        'evidence-outbox-2',
        'evidence-timeline-3',
        'evidence-outbox-3',
        'evidence-timeline-4',
        'evidence-outbox-4',
      ]),
    });
    const retry = await persistEvidenceItems(store, input, {
      ids: sequenceIdGenerator([]),
    });
    expect(retry).toEqual(first);
    const counts = await store.execute({
      sql: 'SELECT count(*) AS count FROM evidence_items',
    });
    expect(Number(counts.rows[0]?.count)).toBe(4);
    await expect(
      persistEvidenceItems(
        store,
        {
          ...input,
          facts: [{ ...result.facts[0]!, value: 'owner' }],
        },
        { ids: sequenceIdGenerator([]) },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    store.close();
  });

  it('fails closed on tamper and rolls back evidence plus timeline atomically', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const { context } = await seedInvestigationInvestigation(store);
    const facts = [
      {
        semanticKey: 'one',
        observedAt: context.occurredAt,
        factType: 'test.value',
        value: 'one',
        confidence: 1,
        confidenceProvenance: 'rule-v1' as const,
        rawPayloadRef: 'protected:test:one',
        sensitivity: 'internal' as const,
        incomplete: false,
      },
      {
        semanticKey: 'two',
        observedAt: context.occurredAt,
        factType: 'test.value',
        value: 'two',
        confidence: 1,
        confidenceProvenance: 'rule-v1' as const,
        rawPayloadRef: 'protected:test:two',
        sensitivity: 'internal' as const,
        incomplete: false,
      },
    ];
    await expect(
      persistEvidenceItems(
        store,
        { context, source: 'identity', provider: 'local-identity', facts },
        {
          clock: fixedClock(evidenceCollectedAt),
          ids: sequenceIdGenerator(['timeline-only', 'outbox-only']),
        },
      ),
    ).rejects.toBeDefined();
    expect(
      Number(
        (
          await store.execute({
            sql: 'SELECT count(*) AS count FROM evidence_items',
          })
        ).rows[0]?.count,
      ),
    ).toBe(0);
    const persisted = await persistEvidenceItems(
      store,
      {
        context,
        source: 'identity',
        provider: 'local-identity',
        facts: [facts[0]!],
      },
      {
        clock: fixedClock(evidenceCollectedAt),
        ids: sequenceIdGenerator(['timeline-ok', 'outbox-ok']),
      },
    );
    await store.execute({
      sql: 'UPDATE evidence_items SET integrity_hash = ? WHERE id = ?',
      args: ['0'.repeat(64), persisted[0]!.evidenceId],
    });
    await expect(readVerifiedEvidence(store, context, [persisted[0]!.evidenceId])).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(readVerifiedEvidence(store, context, ['missing-evidence'])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      readVerifiedEvidence(store, { ...context, tenantId: 'other-tenant' }, [persisted[0]!.evidenceId]),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    store.close();
  });

  it('converges concurrent redeliveries and survives reopen', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const setup = database.createStore();
    const { context } = await seedInvestigationInvestigation(setup);
    setup.close();
    const facts = [
      {
        semanticKey: 'stable',
        observedAt: context.occurredAt,
        factType: 'test.stable',
        value: true,
        confidence: 1,
        confidenceProvenance: 'rule-v1' as const,
        rawPayloadRef: 'protected:test:stable',
        sensitivity: 'internal' as const,
        incomplete: false,
      },
    ];
    const first = database.createStore();
    const second = database.createStore();
    const makeIds = () => sequenceIdGenerator([crypto.randomUUID(), crypto.randomUUID()]);
    const results = await Promise.all([
      persistEvidenceItems(
        first,
        { context, source: 'identity', provider: 'local-identity', facts },
        { clock: fixedClock(evidenceCollectedAt), ids: makeIds() },
      ),
      persistEvidenceItems(
        second,
        { context, source: 'identity', provider: 'local-identity', facts },
        { clock: fixedClock(evidenceCollectedAt), ids: makeIds() },
      ),
    ]);
    expect(results[0]).toEqual(results[1]);
    first.close();
    second.close();
    const reopened = database.createStore();
    const readback = await readVerifiedEvidence(reopened, context, [results[0]![0]!.evidenceId]);
    expect(readback).toEqual(results[0]);
    reopened.close();
  });

  it('inserts one stable correlation event across replay and concurrency', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const setup = database.createStore();
    const { context } = await seedInvestigationInvestigation(setup);
    setup.close();
    const branch = (source: 'identity' | 'endpoint' | 'cloud') => ({
      source,
      status: 'success' as const,
      evidenceIds: [],
      startedAt: evidenceCollectedAt,
      finishedAt: evidenceCollectedAt,
      latencyMs: 0,
      stepId: `gather-${source}-evidence` as const,
      toolCallIds: [],
    });
    const correlation = CorrelationSchema.parse({
      context,
      branches: [branch('identity'), branch('endpoint'), branch('cloud')],
      orderedEvents: [],
      relations: [],
      contradictions: [],
      missingData: [],
    });
    const first = database.createStore();
    const second = database.createStore();
    await Promise.all([
      appendCorrelationTimeline(first, correlation, {
        clock: fixedClock('2026-08-27T12:02:00.000Z'),
      }),
      appendCorrelationTimeline(second, correlation, {
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      }),
    ]);
    await appendCorrelationTimeline(first, correlation, {
      clock: fixedClock('2026-08-27T12:04:00.000Z'),
    });
    first.close();
    second.close();
    const verification = database.createStore();
    const events = await verification.execute({
      sql: `SELECT id, sequence, causation_id FROM timeline_events
        WHERE type = 'evidence.correlated'`,
    });
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]).toMatchObject({
      id: expect.stringMatching(/^cor_[a-f0-9]{64}$/u),
      sequence: 3,
      causation_id: context.eventId,
    });
    verification.close();
  });
});
