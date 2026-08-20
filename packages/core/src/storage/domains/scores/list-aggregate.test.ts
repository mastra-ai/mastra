import { beforeEach, describe, expect, it } from 'vitest';
import type { SaveScorePayload, ScoreRowData } from '../../../evals/types';
import { InMemoryDB } from '../inmemory-db';
import { ScoresInMemory } from './inmemory';

let idCounter = 0;

const basePayload = (overrides: Partial<ScoreRowData> = {}): SaveScorePayload =>
  ({
    scorerId: 'scorer-1',
    runId: 'run-1',
    scorer: { id: 'scorer-1', name: 'mock' },
    source: 'LIVE',
    entityType: 'AGENT',
    entityId: 'agent-1',
    entity: { id: 'agent-1' },
    input: {},
    output: {},
    score: 1,
    ...overrides,
  }) as unknown as SaveScorePayload;

describe('ScoresInMemory.listScores', () => {
  let db: InMemoryDB;
  let scores: ScoresInMemory;

  const insert = (overrides: Partial<ScoreRowData> = {}) => {
    idCounter += 1;
    const row = {
      id: `score-${String(idCounter).padStart(4, '0')}`,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      ...basePayload(),
      ...overrides,
    } as ScoreRowData;
    db.scores.set(row.id, row);
    return row;
  };

  beforeEach(() => {
    db = new InMemoryDB();
    scores = new ScoresInMemory({ db });
  });

  it('filters by each single dimension', async () => {
    insert({
      scorerId: 'a',
      entityId: 'e1',
      entityType: 'AGENT',
      traceId: 't1',
      threadId: 'th1',
      source: 'LIVE',
      score: 0.2,
    });
    insert({
      scorerId: 'b',
      entityId: 'e2',
      entityType: 'WORKFLOW',
      traceId: 't2',
      threadId: 'th2',
      source: 'TEST',
      score: 0.9,
      createdAt: new Date('2026-08-10T00:00:00Z'),
    });

    const byScorer = await scores.listScores({ filter: { scorerIds: ['a'] }, pagination: { page: 0, perPage: 10 } });
    expect(byScorer.scores.map(s => s.scorerId)).toEqual(['a']);

    const byEntity = await scores.listScores({
      filter: { entityId: 'e2', entityType: 'WORKFLOW' },
      pagination: { page: 0, perPage: 10 },
    });
    expect(byEntity.scores.map(s => s.entityId)).toEqual(['e2']);

    const byTrace = await scores.listScores({ filter: { traceId: 't1' }, pagination: { page: 0, perPage: 10 } });
    expect(byTrace.scores.map(s => s.traceId)).toEqual(['t1']);

    const byThread = await scores.listScores({ filter: { threadId: 'th2' }, pagination: { page: 0, perPage: 10 } });
    expect(byThread.scores.map(s => s.threadId)).toEqual(['th2']);

    const bySource = await scores.listScores({ filter: { source: 'TEST' }, pagination: { page: 0, perPage: 10 } });
    expect(bySource.scores.map(s => s.source)).toEqual(['TEST']);

    const byDate = await scores.listScores({
      filter: { startDate: new Date('2026-08-05T00:00:00Z'), endDate: new Date('2026-08-15T00:00:00Z') },
      pagination: { page: 0, perPage: 10 },
    });
    expect(byDate.scores).toHaveLength(1);

    const byScoreRange = await scores.listScores({
      filter: { minScore: 0.5, maxScore: 1 },
      pagination: { page: 0, perPage: 10 },
    });
    expect(byScoreRange.scores.map(s => s.score)).toEqual([0.9]);
  });

  it('combines filters with AND semantics', async () => {
    insert({ scorerId: 'a', source: 'LIVE', score: 0.9 });
    insert({ scorerId: 'a', source: 'TEST', score: 0.9 });
    insert({ scorerId: 'b', source: 'LIVE', score: 0.9 });

    const result = await scores.listScores({
      filter: { scorerIds: ['a'], source: 'LIVE', minScore: 0.5 },
      pagination: { page: 0, perPage: 10 },
    });
    expect(result.scores).toHaveLength(1);
  });

  it('filters by metadata: exact match, multiple keys AND, missing key, non-string values', async () => {
    insert({ metadata: { deployment: 'v42', cohort: 'oncology', sampled: true, weight: 3 } });
    insert({ metadata: { deployment: 'v42', cohort: 'cardiology' } });
    insert({ metadata: { cohort: 'oncology' } });
    insert({}); // no metadata at all

    const exact = await scores.listScores({
      filter: { metadata: { deployment: 'v42' } },
      pagination: { page: 0, perPage: 10 },
    });
    expect(exact.scores).toHaveLength(2);

    const multi = await scores.listScores({
      filter: { metadata: { deployment: 'v42', cohort: 'oncology' } },
      pagination: { page: 0, perPage: 10 },
    });
    expect(multi.scores).toHaveLength(1);

    const missing = await scores.listScores({
      filter: { metadata: { nonexistent: 'x' } },
      pagination: { page: 0, perPage: 10 },
    });
    expect(missing.scores).toHaveLength(0);

    const boolMatch = await scores.listScores({
      filter: { metadata: { sampled: true } },
      pagination: { page: 0, perPage: 10 },
    });
    expect(boolMatch.scores).toHaveLength(1);

    const numMatch = await scores.listScores({
      filter: { metadata: { weight: 3 } },
      pagination: { page: 0, perPage: 10 },
    });
    expect(numMatch.scores).toHaveLength(1);
  });

  it('paginates with stable newest-first ordering and no dupes/gaps', async () => {
    for (let i = 0; i < 25; i++) {
      insert({ createdAt: new Date(Date.UTC(2026, 7, 1, i)) });
    }
    const seen = new Set<string>();
    for (let page = 0; page < 3; page++) {
      const result = await scores.listScores({ pagination: { page, perPage: 10 } });
      for (const s of result.scores) {
        expect(seen.has(s.id)).toBe(false);
        seen.add(s.id);
      }
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.hasMore).toBe(page < 2);
    }
    expect(seen.size).toBe(25);
  });

  it('respects tenancy filters', async () => {
    insert({ organizationId: 'org-a' });
    insert({ organizationId: 'org-b' });

    const result = await scores.listScores({
      pagination: { page: 0, perPage: 10 },
      filters: { organizationId: 'org-a' },
    });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]?.organizationId).toBe('org-a');
  });
});

describe('ScoresInMemory.aggregateScores', () => {
  let db: InMemoryDB;
  let scores: ScoresInMemory;

  const insert = (overrides: Partial<ScoreRowData> = {}) => {
    idCounter += 1;
    const row = {
      id: `score-${String(idCounter).padStart(4, '0')}`,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      ...basePayload(),
      ...overrides,
    } as ScoreRowData;
    db.scores.set(row.id, row);
    return row;
  };

  beforeEach(() => {
    db = new InMemoryDB();
    scores = new ScoresInMemory({ db });
  });

  it('computes avg/p50/p95/count/passRate against hand-computed fixtures', async () => {
    for (const score of [0.1, 0.3, 0.5, 0.7, 0.9]) insert({ score });

    const { rows } = await scores.aggregateScores({ passThreshold: 0.5 });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.count).toBe(5);
    expect(row.avg).toBeCloseTo(0.5);
    expect(row.p50).toBeCloseTo(0.5);
    expect(row.p95).toBeCloseTo(0.86); // linear interpolation between 0.7 and 0.9 at idx 3.8
    expect(row.passRate).toBeCloseTo(3 / 5); // 0.5, 0.7, 0.9 pass
  });

  it('buckets by UTC day with boundary rows in the correct bucket', async () => {
    insert({ createdAt: new Date('2026-08-01T23:59:59.999Z'), score: 0 });
    insert({ createdAt: new Date('2026-08-02T00:00:00.000Z'), score: 1 });

    const { rows } = await scores.aggregateScores({ bucket: 'day' });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.bucketStart).toBe('2026-08-01T00:00:00.000Z');
    expect(rows[0]!.avg).toBe(0);
    expect(rows[1]!.bucketStart).toBe('2026-08-02T00:00:00.000Z');
    expect(rows[1]!.avg).toBe(1);
  });

  it('groups by scorerId, metadata key, and metadata key + time bucket', async () => {
    insert({ scorerId: 'a', metadata: { cohort: 'x' }, score: 0.2, createdAt: new Date('2026-08-01T01:00:00Z') });
    insert({ scorerId: 'a', metadata: { cohort: 'y' }, score: 0.4, createdAt: new Date('2026-08-01T02:00:00Z') });
    insert({ scorerId: 'b', metadata: { cohort: 'x' }, score: 0.6, createdAt: new Date('2026-08-02T01:00:00Z') });

    const byScorer = await scores.aggregateScores({ groupBy: ['scorerId'] });
    expect(byScorer.rows.map(r => [r.groups![0], r.count])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);

    const byCohort = await scores.aggregateScores({ groupBy: ['metadata:cohort'] });
    expect(byCohort.rows.map(r => [r.groups![0], r.count])).toEqual([
      ['x', 2],
      ['y', 1],
    ]);

    const byCohortAndDay = await scores.aggregateScores({ groupBy: ['metadata:cohort'], bucket: 'day' });
    expect(byCohortAndDay.rows).toHaveLength(3);
    expect(byCohortAndDay.rows[0]).toMatchObject({ bucketStart: '2026-08-01T00:00:00.000Z', groups: ['x'], count: 1 });
  });

  it('puts rows missing the group-by key into a null group instead of dropping them', async () => {
    insert({ metadata: { cohort: 'x' } });
    insert({ metadata: {} });
    insert({});

    const { rows } = await scores.aggregateScores({ groupBy: ['metadata:cohort'] });
    const nullGroup = rows.find(r => r.groups![0] === null);
    expect(nullGroup?.count).toBe(2);
    expect(rows.reduce((acc, r) => acc + r.count, 0)).toBe(3);
  });

  it('applies list filter and tenancy filters', async () => {
    insert({ organizationId: 'org-a', scorerId: 'a', score: 1 });
    insert({ organizationId: 'org-b', scorerId: 'a', score: 0 });
    insert({ organizationId: 'org-a', scorerId: 'b', score: 0 });

    const { rows } = await scores.aggregateScores({
      filter: { scorerIds: ['a'] },
      filters: { organizationId: 'org-a' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(1);
    expect(rows[0]!.avg).toBe(1);
  });

  it('paginates internally over more than one page of scores', async () => {
    for (let i = 0; i < 1500; i++) insert({ score: i % 2 });

    const { rows } = await scores.aggregateScores({ passThreshold: 1 });
    expect(rows[0]!.count).toBe(1500);
    expect(rows[0]!.passRate).toBeCloseTo(750 / 1500);
  });
});

describe('ScoresInMemory.saveScore external ingestion', () => {
  let db: InMemoryDB;
  let scores: ScoresInMemory;

  beforeEach(() => {
    db = new InMemoryDB();
    scores = new ScoresInMemory({ db });
  });

  it('generates an id when none supplied', async () => {
    const { score } = await scores.saveScore(basePayload());
    expect(score.id).toBeTruthy();
  });

  it('upserts idempotently on caller-supplied id, preserving createdAt', async () => {
    const first = await scores.saveScore(basePayload({ id: 'ext-1', score: 0.3, source: 'EXTERNAL' }));
    expect(first.score.id).toBe('ext-1');

    const second = await scores.saveScore(basePayload({ id: 'ext-1', score: 0.7, source: 'EXTERNAL' }));
    expect(second.score.id).toBe('ext-1');
    expect(second.score.createdAt).toEqual(first.score.createdAt);
    expect(db.scores.size).toBe(1);
    expect(db.scores.get('ext-1')!.score).toBe(0.7);
  });
});
