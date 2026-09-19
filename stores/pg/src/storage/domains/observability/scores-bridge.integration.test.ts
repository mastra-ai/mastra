import { randomUUID } from 'node:crypto';

import type { SaveScorePayload } from '@mastra/core/evals';
import { EntityType, scoreRecordSchema } from '@mastra/core/storage';
import type { ObservabilityStorage, ScoreRecord, ScoresFilter, ScoresStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { getSchemaName } from '../../db';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const schemaName = `score_bridge_${process.pid}_${Date.now()}`;

function legacyScore(overrides: Partial<SaveScorePayload> = {}): SaveScorePayload {
  const scorerId = overrides.scorerId ?? `legacy-scorer-${randomUUID()}`;
  const entityId = overrides.entityId ?? `legacy-entity-${randomUUID()}`;
  return {
    runId: `legacy-run-${randomUUID()}`,
    scorerId,
    scorer: { id: scorerId, name: 'Legacy quality scorer', version: '1.2.3' },
    input: { prompt: 'input' },
    output: { text: 'output' },
    score: 0.75,
    reason: 'legacy score reason',
    metadata: {},
    requestContext: {},
    source: 'LIVE',
    entity: { id: entityId, name: 'Legacy agent' },
    entityType: 'AGENT',
    entityId,
    ...overrides,
  };
}

function observabilityScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    scoreId: `observability-score-${randomUUID()}`,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    scorerId: 'observability-scorer',
    score: 0.5,
    ...overrides,
  };
}

describe('PostgresStore observability scores bridge', () => {
  let store: PostgresStore;
  let scores: ScoresStorage;
  let observability: ObservabilityStorage;

  beforeAll(async () => {
    store = new PostgresStore({ ...TEST_CONFIG, id: 'pg-observability-scores-bridge', schemaName });
    await store.init();
    scores = (await store.getStore('scores'))!;
    observability = (await store.getStore('observability'))!;
  });

  beforeEach(async () => {
    await scores.dangerouslyClearAll();
  });

  afterAll(async () => {
    await store.db.none(`DROP SCHEMA IF EXISTS ${getSchemaName(schemaName)} CASCADE`);
    await store.close();
  });

  it('lists a score written through the existing scores domain', async () => {
    const scorerId = 'cross-domain-scorer';
    const { score: saved } = await scores.saveScore(
      legacyScore({
        scorerId,
        scorer: { id: scorerId, name: 'Cross-domain scorer', version: '2.0.0' },
        traceId: 'legacy-trace',
        spanId: 'legacy-span',
        runId: 'legacy-run',
        resourceId: 'legacy-resource',
        threadId: 'legacy-thread',
        organizationId: 'legacy-organization',
        entityId: 'legacy-agent-id',
        entity: { id: 'legacy-agent-id', name: 'Legacy agent name' },
        metadata: { customField: 'preserved', tags: ['legacy-tag'] },
        requestContext: { experimentId: 'legacy-experiment', scoreTraceId: 'legacy-score-trace' },
      }),
    );

    const result = await observability.listScores({ filters: { scorerId } });

    expect(result.pagination).toEqual({ total: 1, page: 0, perPage: 10, hasMore: false });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]).toMatchObject({
      scoreId: saved.id,
      traceId: 'legacy-trace',
      spanId: 'legacy-span',
      scorerId,
      scorerName: 'Cross-domain scorer',
      scorerVersion: '2.0.0',
      scoreSource: 'LIVE',
      source: 'LIVE',
      score: 0.75,
      reason: 'legacy score reason',
      entityType: EntityType.AGENT,
      entityId: 'legacy-agent-id',
      entityName: 'Legacy agent name',
      organizationId: 'legacy-organization',
      resourceId: 'legacy-resource',
      runId: 'legacy-run',
      threadId: 'legacy-thread',
      experimentId: 'legacy-experiment',
      scoreTraceId: 'legacy-score-trace',
      tags: ['legacy-tag'],
      metadata: { customField: 'preserved', tags: ['legacy-tag'] },
    });
    expect(result.scores[0]!.timestamp.getTime()).toBe(saved.createdAt.getTime());
    expect(scoreRecordSchema.safeParse(result.scores[0]).success).toBe(true);
    await expect(scores.getScoreById({ id: saved.id })).resolves.toMatchObject({
      id: saved.id,
      input: { prompt: 'input' },
      output: { text: 'output' },
      score: 0.75,
    });
  });

  it('returns correct empty pagination and supports scalar and array scorer filters', async () => {
    const first = await scores.saveScore(legacyScore({ scorerId: 'scorer-a' }));
    const second = await scores.saveScore(legacyScore({ scorerId: 'scorer-b' }));
    await scores.saveScore(legacyScore({ scorerId: 'scorer-c' }));

    await expect(
      observability.listScores({
        filters: { scorerId: 'missing-scorer' },
        pagination: { page: 3, perPage: 7 },
      }),
    ).resolves.toEqual({
      scores: [],
      pagination: { total: 0, page: 3, perPage: 7, hasMore: false },
    });

    const scalar = await observability.listScores({ filters: { scorerId: 'scorer-a' } });
    expect(scalar.scores.map(score => score.scoreId)).toEqual([first.score.id]);

    const array = await observability.listScores({
      filters: { scorerId: ['scorer-a', 'scorer-b'] },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    expect(array.pagination.total).toBe(2);
    expect(new Set(array.scores.map(score => score.scoreId))).toEqual(new Set([first.score.id, second.score.id]));

    await expect(observability.listScores({ filters: { scorerId: [] } })).resolves.toEqual({
      scores: [],
      pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
    });
  });

  it('filters timestamps and orders and paginates with deterministic ID tie-breakers', async () => {
    const dayOne = new Date('2026-02-01T00:00:00.000Z');
    const dayTwo = new Date('2026-02-02T00:00:00.000Z');
    const dayThree = new Date('2026-02-03T00:00:00.000Z');
    const scorerId = 'ordering-scorer';
    await observability.batchCreateScores({
      scores: [
        observabilityScore({ scoreId: 'order-a', timestamp: dayOne, scorerId, score: 0.5 }),
        observabilityScore({ scoreId: 'order-b', timestamp: dayTwo, scorerId, score: 0.9 }),
        observabilityScore({ scoreId: 'order-c', timestamp: dayTwo, scorerId, score: 0.9 }),
        observabilityScore({ scoreId: 'order-d', timestamp: dayThree, scorerId, score: 0.1 }),
      ],
    });

    const timestampRange = await observability.listScores({
      filters: {
        scorerId,
        timestamp: { start: dayOne, end: dayThree, startExclusive: true, endExclusive: true },
      },
    });
    expect(timestampRange.scores.map(score => score.scoreId)).toEqual(['order-c', 'order-b']);

    const firstPage = await observability.listScores({
      filters: { scorerId },
      pagination: { page: 0, perPage: 2 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    expect(firstPage.scores.map(score => score.scoreId)).toEqual(['order-a', 'order-b']);
    expect(firstPage.pagination).toEqual({ total: 4, page: 0, perPage: 2, hasMore: true });

    const secondPage = await observability.listScores({
      filters: { scorerId },
      pagination: { page: 1, perPage: 2 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    expect(secondPage.scores.map(score => score.scoreId)).toEqual(['order-c', 'order-d']);
    expect(secondPage.pagination).toEqual({ total: 4, page: 1, perPage: 2, hasMore: false });

    const byScore = await observability.listScores({
      filters: { scorerId },
      orderBy: { field: 'score', direction: 'DESC' },
    });
    expect(byScore.scores.map(score => score.scoreId)).toEqual(['order-c', 'order-b', 'order-a', 'order-d']);

    const ascendingScore = await observability.listScores({ orderBy: { field: 'score', direction: 'ASC' } });
    expect(ascendingScore.scores.map(score => score.scoreId)).toEqual(['order-d', 'order-a', 'order-b', 'order-c']);
    const inclusiveRange = await observability.listScores({ filters: { timestamp: { start: dayTwo, end: dayTwo } } });
    expect(inclusiveRange.scores.map(score => score.scoreId)).toEqual(['order-c', 'order-b']);
    await expect(observability.listScores({ mode: 'page', pagination: { page: 2, perPage: 2 } })).resolves.toEqual({
      scores: [],
      pagination: { total: 4, page: 2, perPage: 2, hasMore: false },
    });
  });

  it('filters serialized legacy JSON with the same fallback precedence as returned records', async () => {
    const { score: saved } = await scores.saveScore(
      legacyScore({
        organizationId: 'column-org',
        entity: { id: 'entity-id', name: 'Entity name' },
        metadata: {
          organizationId: 'stale-org',
          entityName: 'stale-name',
          userId: 'metadata-user',
          traceId: 'metadata-trace',
          resourceId: 'metadata-resource',
          tags: ['tag-a', 'tag-b'],
          nested: { active: true },
          nullable: null,
          "quoted'key": "value' OR TRUE --",
        },
        requestContext: {
          organizationId: 'stale-context-org',
          userId: 'stale-user',
          spanId: 'context-span',
          threadId: 'context-thread',
          experimentId: 'context-experiment',
          parentEntityType: 'WORKFLOW',
          rootEntityType: 'AGENT',
        },
      }),
    );
    await scores.saveScore(legacyScore());

    const matching: ScoresFilter[] = [
      { entityName: 'Entity name' },
      { organizationId: 'column-org' },
      { userId: 'metadata-user' },
      { traceId: 'metadata-trace' },
      { spanId: 'context-span' },
      { resourceId: 'metadata-resource' },
      { threadId: 'context-thread' },
      { experimentId: 'context-experiment' },
      { parentEntityType: EntityType.WORKFLOW_RUN },
      { rootEntityType: EntityType.AGENT },
      { tags: ['tag-b', 'tag-a'] },
      { metadata: { nested: { active: true }, nullable: null } },
      { metadata: { "quoted'key": "value' OR TRUE --" } },
    ];
    for (const filters of matching) {
      const result = await observability.listScores({ filters });
      expect(
        result.scores.map(score => score.scoreId),
        JSON.stringify(filters),
      ).toEqual([saved.id]);
      expect(result.pagination!.total).toBe(1);
    }
    const nonMatching: ScoresFilter[] = [
      { organizationId: 'stale-org' },
      { organizationId: 'stale-context-org' },
      { entityName: 'stale-name' },
      { userId: 'stale-user' },
      { tags: ['tag-a', 'missing'] },
      { metadata: { nested: {} } },
      { metadata: { missing: null } },
      { scorerId: "' OR TRUE --" },
    ];
    for (const filters of nonMatching) {
      expect((await observability.listScores({ filters })).scores, JSON.stringify(filters)).toEqual([]);
    }
    await expect(observability.getScoreById(saved.id)).resolves.toMatchObject({
      organizationId: 'column-org',
      entityName: 'Entity name',
      userId: 'metadata-user',
      traceId: 'metadata-trace',
      spanId: 'context-span',
      resourceId: 'metadata-resource',
      threadId: 'context-thread',
      parentEntityType: EntityType.WORKFLOW_RUN,
      rootEntityType: EntityType.AGENT,
    });
  });

  it('uses serialized scorer and entity fallbacks and UTC timestamps consistently in queries', async () => {
    const { score: saved } = await scores.saveScore(
      legacyScore({
        scorer: { id: 'fallback-scorer', name: 'Fallback scorer', version: 'v1' },
        entity: { id: 'fallback-entity', name: 'Fallback entity', type: 'TOOL' },
      }),
    );
    const timestamp = new Date('2026-02-02T12:00:00Z');
    await store.db.none(
      `UPDATE ${getSchemaName(schemaName)}."mastra_scorers"
      SET "scorerId" = '', "entityId" = NULL, "entityType" = NULL,
          "createdAtZ" = NULL, "createdAt" = $1 WHERE id = $2`,
      [timestamp.toISOString(), saved.id],
    );
    await observability.createScore({ score: observabilityScore({ timestamp: new Date('2026-02-03T00:00:00Z') }) });
    const result = await observability.listScores({
      filters: {
        scorerId: ['fallback-scorer'],
        entityType: EntityType.TOOL,
        timestamp: { start: timestamp, end: timestamp },
      },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]).toMatchObject({
      scoreId: saved.id,
      timestamp,
      scorerId: 'fallback-scorer',
      scorerName: 'Fallback scorer',
      scorerVersion: 'v1',
      entityId: 'fallback-entity',
      entityName: 'Fallback entity',
      entityType: EntityType.TOOL,
    });
    await expect(observability.getScoreById(saved.id)).resolves.toMatchObject({ timestamp });
    const ordered = await observability.listScores({ orderBy: { field: 'timestamp', direction: 'ASC' } });
    expect(ordered.scores[0]!.scoreId).toBe(saved.id);
  });

  it('supports first-class, contextual, metadata, source, and tag filters', async () => {
    const target = observabilityScore({
      scoreId: 'filter-target',
      scorerId: 'filter-scorer',
      scoreSource: 'manual',
      traceId: 'filter-trace',
      spanId: 'filter-span',
      entityType: EntityType.AGENT,
      entityId: 'filter-agent-id',
      entityName: 'Filter agent',
      entityVersionId: 'agent-version',
      parentEntityType: EntityType.WORKFLOW_RUN,
      parentEntityName: 'Parent workflow',
      parentEntityVersionId: 'parent-version',
      rootEntityType: EntityType.WORKFLOW_RUN,
      rootEntityName: 'Root workflow',
      rootEntityVersionId: 'root-version',
      userId: 'filter-user',
      organizationId: 'filter-organization',
      resourceId: 'filter-resource',
      runId: 'filter-run',
      sessionId: 'filter-session',
      threadId: 'filter-thread',
      requestId: 'filter-request',
      experimentId: 'filter-experiment',
      environment: 'test',
      serviceName: 'filter-service',
      executionSource: 'integration-test',
      tags: ['tag-a', 'tag-b'],
      metadata: { region: 'west', nested: { active: true } },
    });
    await observability.createScore({ score: target });
    await observability.createScore({
      score: observabilityScore({
        scoreId: 'filter-decoy',
        scorerId: 'other-scorer',
        scoreSource: 'automated',
        traceId: 'other-trace',
        entityType: EntityType.WORKFLOW_RUN,
        metadata: { region: 'east' },
      }),
    });

    const filters: Array<[string, ScoresFilter]> = [
      ['traceId', { traceId: 'filter-trace' }],
      ['spanId', { spanId: 'filter-span' }],
      ['entityType', { entityType: EntityType.AGENT }],
      ['entityName', { entityName: 'Filter agent' }],
      ['entityVersionId', { entityVersionId: 'agent-version' }],
      ['parentEntityType', { parentEntityType: EntityType.WORKFLOW_RUN }],
      ['parentEntityName', { parentEntityName: 'Parent workflow' }],
      ['parentEntityVersionId', { parentEntityVersionId: 'parent-version' }],
      ['rootEntityType', { rootEntityType: EntityType.WORKFLOW_RUN }],
      ['rootEntityName', { rootEntityName: 'Root workflow' }],
      ['rootEntityVersionId', { rootEntityVersionId: 'root-version' }],
      ['userId', { userId: 'filter-user' }],
      ['organizationId', { organizationId: 'filter-organization' }],
      ['resourceId', { resourceId: 'filter-resource' }],
      ['runId', { runId: 'filter-run' }],
      ['sessionId', { sessionId: 'filter-session' }],
      ['threadId', { threadId: 'filter-thread' }],
      ['requestId', { requestId: 'filter-request' }],
      ['experimentId', { experimentId: 'filter-experiment' }],
      ['environment', { environment: 'test' }],
      ['serviceName', { serviceName: 'filter-service' }],
      ['executionSource', { executionSource: 'integration-test' }],
      ['scoreSource', { scoreSource: 'manual' }],
      ['source alias', { source: 'manual' }],
      ['tags', { tags: ['tag-a', 'tag-b'] }],
      ['metadata string', { metadata: { region: 'west' } }],
      ['metadata object', { metadata: { nested: { active: true } } }],
    ];

    for (const [name, filter] of filters) {
      const result = await observability.listScores({ filters: filter });
      expect(
        result.scores.map(score => score.scoreId),
        name,
      ).toEqual(['filter-target']);
    }

    await expect(observability.getScoreById('filter-target')).resolves.toMatchObject(target);
  });

  it('creates and batch-creates scores in the shared scorer table without clobbering metadata', async () => {
    await observability.createScore({
      score: observabilityScore({
        scoreId: 'created-single',
        entityName: undefined,
        userId: null,
        tags: null,
        metadata: {
          entityName: 'metadata-only-name',
          userId: 'metadata-user',
          tags: ['metadata-tag'],
          customField: 'kept',
          nullable: null,
        },
      }),
    });
    await observability.batchCreateScores({
      scores: [
        observabilityScore({
          scoreId: 'created-batch-a',
          entityName: 'top-level-name',
          metadata: { entityName: 'stale-name', customField: 'kept' },
        }),
        observabilityScore({ scoreId: 'created-batch-b' }),
      ],
    });

    await expect(observability.getScoreById('created-single')).resolves.toMatchObject({
      scoreId: 'created-single',
      entityName: 'metadata-only-name',
      userId: 'metadata-user',
      tags: ['metadata-tag'],
      metadata: {
        entityName: 'metadata-only-name',
        userId: 'metadata-user',
        tags: ['metadata-tag'],
        customField: 'kept',
        nullable: null,
      },
    });
    await expect(observability.getScoreById('created-batch-a')).resolves.toMatchObject({
      scoreId: 'created-batch-a',
      entityName: 'top-level-name',
      metadata: { entityName: 'top-level-name', customField: 'kept' },
    });
    await expect(observability.getScoreById('missing-score')).resolves.toBeNull();
    await expect(scores.getScoreById({ id: 'created-single' })).resolves.toMatchObject({ id: 'created-single' });

    const listed = await observability.listScores({});
    expect(listed.pagination.total).toBe(3);
  });

  it.each(Object.values(EntityType))('round-trips the %s entity type', async entityType => {
    const score = observabilityScore({ entityType, parentEntityType: entityType, rootEntityType: entityType });
    await observability.createScore({ score });
    const result = await observability.listScores({
      filters: { entityType, parentEntityType: entityType, rootEntityType: entityType },
    });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]).toMatchObject(score);
  });

  it('generates IDs for scores without IDs and treats empty batches as a no-op', async () => {
    await observability.batchCreateScores({ scores: [] });
    expect((await observability.listScores({})).scores).toEqual([]);
    await observability.createScore({ score: observabilityScore({ scoreId: undefined }) });
    const result = await observability.listScores({});
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]!.scoreId).toEqual(expect.any(String));
    await expect(scores.getScoreById({ id: result.scores[0]!.scoreId! })).resolves.toMatchObject({ score: 0.5 });
  });

  it('rolls back an entire batch on a database error', async () => {
    await observability.createScore({ score: observabilityScore({ scoreId: 'existing-id' }) });
    await expect(
      observability.batchCreateScores({
        scores: [observabilityScore({ scoreId: 'rolled-back' }), observabilityScore({ scoreId: 'existing-id' })],
      }),
    ).rejects.toMatchObject({ id: expect.stringContaining('BATCH_CREATE_SCORES_FAILED') });
    await expect(observability.getScoreById('rolled-back')).resolves.toBeNull();
    expect((await observability.listScores({})).pagination!.total).toBe(1);
  });

  it('surfaces invalid serialized JSON as a storage error', async () => {
    await observability.createScore({ score: observabilityScore({ scoreId: 'invalid-json' }) });
    await store.db.none(`UPDATE ${getSchemaName(schemaName)}."mastra_scorers" SET metadata = $1::jsonb WHERE id = $2`, [
      JSON.stringify('{invalid'),
      'invalid-json',
    ]);
    await expect(observability.listScores({})).rejects.toMatchObject({
      id: expect.stringContaining('LIST_SCORES_FAILED'),
    });
    await expect(observability.listScores({ filters: { metadata: { key: 'value' } } })).rejects.toMatchObject({
      id: expect.stringContaining('LIST_SCORES_FAILED'),
    });
    await expect(observability.getScoreById('invalid-json')).rejects.toMatchObject({
      id: expect.stringContaining('GET_SCORE_BY_ID_FAILED'),
    });
  });

  it('rejects delta polling instead of approximating it', async () => {
    expect(observability.getFeatures() ?? []).not.toContain('delta-polling');
    await expect(observability.listScores({ mode: 'delta' })).rejects.toMatchObject({
      id: expect.stringContaining('LIST_SCORES_DELTA_NOT_SUPPORTED'),
    });
  });
});
