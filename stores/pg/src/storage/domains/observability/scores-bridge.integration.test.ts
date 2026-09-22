import { randomUUID } from 'node:crypto';

import type { SaveScorePayload } from '@mastra/core/evals';
import { EntityType, scoreRecordSchema } from '@mastra/core/storage';
import type { ObservabilityStorage, ScoresFilter, ScoresStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { getSchemaName } from '../../db';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const schemaName = `score_bridge_${process.pid}_${Date.now()}`;

/** Build a valid score payload for the legacy persistence API. */
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

describe('PostgresStore observability scores bridge', () => {
  let store: PostgresStore;
  let scores: ScoresStorage;
  let observability: ObservabilityStorage;

  /** Seed historical records through the supported writer, then set their recorded time. */
  async function saveLegacyScore(overrides: Partial<SaveScorePayload>, timestamp?: Date) {
    const { score } = await scores.saveScore(legacyScore(overrides));
    if (timestamp) {
      await store.db.none(
        `UPDATE ${getSchemaName(schemaName)}."mastra_scorers"
         SET "createdAt" = $1, "createdAtZ" = $1 WHERE id = $2`,
        [timestamp.toISOString(), score.id],
      );
    }
    return score;
  }

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
    await saveLegacyScore({ id: 'order-a', scorerId, score: 0.5 }, dayOne);
    await saveLegacyScore({ id: 'order-b', scorerId, score: 0.9 }, dayTwo);
    await saveLegacyScore({ id: 'order-c', scorerId, score: 0.9 }, dayTwo);
    await saveLegacyScore({ id: 'order-d', scorerId, score: 0.1 }, dayThree);

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

  it('filters legacy JSON objects with the same fallback precedence as returned records', async () => {
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

  it('uses scorer and entity fallbacks and UTC timestamps consistently in queries', async () => {
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
    await saveLegacyScore({}, new Date('2026-02-03T00:00:00Z'));
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
    await saveLegacyScore({
      id: 'filter-target',
      scorerId: 'filter-scorer',
      source: 'TEST',
      traceId: 'filter-trace',
      spanId: 'filter-span',
      entityType: 'AGENT',
      entityId: 'filter-agent-id',
      entity: { id: 'filter-agent-id', name: 'Filter agent' },
      organizationId: 'filter-organization',
      resourceId: 'filter-resource',
      runId: 'filter-run',
      threadId: 'filter-thread',
      metadata: {
        entityVersionId: 'agent-version',
        parentEntityType: 'WORKFLOW',
        parentEntityName: 'Parent workflow',
        parentEntityVersionId: 'parent-version',
        rootEntityType: 'WORKFLOW',
        rootEntityName: 'Root workflow',
        rootEntityVersionId: 'root-version',
        userId: 'filter-user',
        sessionId: 'filter-session',
        requestId: 'filter-request',
        experimentId: 'filter-experiment',
        environment: 'test',
        serviceName: 'filter-service',
        executionSource: 'integration-test',
        tags: ['tag-a', 'tag-b'],
        region: 'west',
        nested: { active: true },
      },
    });
    await saveLegacyScore({
      id: 'filter-decoy',
      scorerId: 'other-scorer',
      source: 'LIVE',
      traceId: 'other-trace',
      entityType: 'WORKFLOW',
      metadata: { region: 'east' },
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
      ['scoreSource', { scoreSource: 'TEST' }],
      ['source alias', { source: 'TEST' }],
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

    await expect(observability.getScoreById('filter-target')).resolves.toMatchObject({
      scoreId: 'filter-target', scorerId: 'filter-scorer', scoreSource: 'TEST', entityType: EntityType.AGENT,
    });
  });

  it('keeps observability writes unsupported so one scorer result remains one legacy row', async () => {
    const scorerId = 'single-result-scorer';
    const emission = {
      timestamp: new Date(),
      scorerId,
      scoreSource: 'experiment',
      traceId: 'target-trace',
      entityType: EntityType.AGENT,
      score: 0.75,
    };
    await expect(observability.createScore({ score: emission })).rejects.toMatchObject({
      id: 'OBSERVABILITY_STORAGE_CREATE_SCORE_NOT_IMPLEMENTED',
    });
    await expect(observability.batchCreateScores({ scores: [emission] })).rejects.toMatchObject({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_SCORES_NOT_IMPLEMENTED',
    });
    const saved = await saveLegacyScore({ scorerId, traceId: 'target-trace', runId: 'real-run', source: 'TEST' });
    const result = await observability.listScores({ filters: { scorerId } });
    expect(result.pagination!.total).toBe(1);
    expect(result.scores).toMatchObject([{ scoreId: saved.id, runId: 'real-run', scoreSource: 'TEST' }]);
    await expect(observability.getScoreById('missing-score')).resolves.toBeNull();
  });

  it('reflects legacy score updates without introducing a second identity', async () => {
    await saveLegacyScore({ id: 'retried-score', scorerId: 'retry-scorer', score: 0.5 });
    await saveLegacyScore({ id: 'retried-score', scorerId: 'retry-scorer', score: 0.9 });
    const result = await observability.listScores({ filters: { scorerId: 'retry-scorer' } });
    expect(result.pagination!.total).toBe(1);
    expect(result.scores).toMatchObject([{ scoreId: 'retried-score', score: 0.9 }]);
    await expect(observability.getScoreById('retried-score')).resolves.toMatchObject({ score: 0.9 });
  });

  it.each([
    ['AGENT', EntityType.AGENT],
    ['WORKFLOW', EntityType.WORKFLOW_RUN],
    ['TRAJECTORY', EntityType.TRAJECTORY],
    ['STEP', EntityType.WORKFLOW_STEP],
    ['tool', EntityType.TOOL],
    ['agent_run', EntityType.AGENT],
  ])('maps legacy %s entity types consistently for reads and filters', async (legacyType, entityType) => {
    const saved = await saveLegacyScore({
      entityType: legacyType,
      metadata: { parentEntityType: legacyType, rootEntityType: legacyType },
    });
    const result = await observability.listScores({ filters: { entityType, parentEntityType: entityType, rootEntityType: entityType } });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]).toMatchObject({ scoreId: saved.id, entityType, parentEntityType: entityType, rootEntityType: entityType });
  });

  it('surfaces invalid serialized JSON as a storage error', async () => {
    await saveLegacyScore({ id: 'invalid-json' });
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
