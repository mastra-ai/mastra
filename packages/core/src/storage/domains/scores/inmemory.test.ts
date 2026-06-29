import { describe, it, expect, beforeEach } from 'vitest';
import type { SaveScorePayload } from '../../../evals/types';
import { InMemoryDB } from '../inmemory-db';
import { ScoresInMemory } from './inmemory';

const basePayload = (overrides: Partial<SaveScorePayload> = {}): SaveScorePayload =>
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

describe('ScoresInMemory tenancy', () => {
  let db: InMemoryDB;
  let scores: ScoresInMemory;

  beforeEach(() => {
    db = new InMemoryDB();
    scores = new ScoresInMemory({ db });
  });

  it('persists projectId and organizationId on saved scores', async () => {
    const { score } = await scores.saveScore(basePayload({ organizationId: 'org-a', projectId: 'proj-1' }));
    expect(score.organizationId).toBe('org-a');
    expect(score.projectId).toBe('proj-1');
  });

  it('filters listScoresByScorerId by organizationId and projectId', async () => {
    await scores.saveScore(basePayload({ organizationId: 'org-a', projectId: 'proj-1' }));
    await scores.saveScore(basePayload({ organizationId: 'org-a', projectId: 'proj-2' }));
    await scores.saveScore(basePayload({ organizationId: 'org-b', projectId: 'proj-1' }));

    const byOrg = await scores.listScoresByScorerId({
      scorerId: 'scorer-1',
      pagination: { page: 0, perPage: 10 },
      filters: { organizationId: 'org-a' },
    });
    expect(byOrg.scores).toHaveLength(2);

    const byProject = await scores.listScoresByScorerId({
      scorerId: 'scorer-1',
      pagination: { page: 0, perPage: 10 },
      filters: { organizationId: 'org-a', projectId: 'proj-1' },
    });
    expect(byProject.scores).toHaveLength(1);
    expect(byProject.scores[0]?.organizationId).toBe('org-a');
    expect(byProject.scores[0]?.projectId).toBe('proj-1');
  });

  it('filters listScoresByEntityId by tenancy', async () => {
    await scores.saveScore(basePayload({ organizationId: 'org-a', projectId: 'proj-1' }));
    await scores.saveScore(basePayload({ organizationId: 'org-b', projectId: 'proj-1' }));

    const result = await scores.listScoresByEntityId({
      entityId: 'agent-1',
      entityType: 'AGENT',
      pagination: { page: 0, perPage: 10 },
      filters: { organizationId: 'org-b' },
    });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]?.organizationId).toBe('org-b');
  });

  it('returns all scores when no tenancy filters are provided', async () => {
    await scores.saveScore(basePayload({ organizationId: 'org-a', projectId: 'proj-1' }));
    await scores.saveScore(basePayload({ organizationId: 'org-b', projectId: 'proj-2' }));

    const result = await scores.listScoresByScorerId({
      scorerId: 'scorer-1',
      pagination: { page: 0, perPage: 10 },
    });
    expect(result.scores).toHaveLength(2);
  });
});

describe('ScoresInMemory batchId', () => {
  let db: InMemoryDB;
  let scores: ScoresInMemory;

  beforeEach(() => {
    db = new InMemoryDB();
    scores = new ScoresInMemory({ db });
  });

  it('persists batchId on saved scores', async () => {
    const { score } = await scores.saveScore(basePayload({ batchId: 'batch-1' }));
    expect(score.batchId).toBe('batch-1');
  });

  it('groups scores by batchId while each keeps its own runId', async () => {
    await scores.saveScore(basePayload({ batchId: 'batch-1', runId: 'run-1' }));
    await scores.saveScore(basePayload({ batchId: 'batch-1', runId: 'run-2' }));
    await scores.saveScore(basePayload({ batchId: 'batch-2', runId: 'run-3' }));

    const batch1 = await scores.listScoresByBatchId({
      batchId: 'batch-1',
      pagination: { page: 0, perPage: 10 },
    });
    expect(batch1.scores).toHaveLength(2);
    expect(new Set(batch1.scores.map(s => s.runId))).toEqual(new Set(['run-1', 'run-2']));

    const batch2 = await scores.listScoresByBatchId({
      batchId: 'batch-2',
      pagination: { page: 0, perPage: 10 },
    });
    expect(batch2.scores).toHaveLength(1);
  });

  it('scopes listScoresByBatchId by tenancy', async () => {
    await scores.saveScore(basePayload({ batchId: 'batch-1', organizationId: 'org-a', projectId: 'proj-1' }));
    await scores.saveScore(basePayload({ batchId: 'batch-1', organizationId: 'org-b', projectId: 'proj-1' }));

    const result = await scores.listScoresByBatchId({
      batchId: 'batch-1',
      pagination: { page: 0, perPage: 10 },
      filters: { organizationId: 'org-a', projectId: 'proj-1' },
    });
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]?.organizationId).toBe('org-a');
  });

  it('does not return scores without a matching batchId', async () => {
    await scores.saveScore(basePayload({ runId: 'run-1' }));

    const result = await scores.listScoresByBatchId({
      batchId: 'batch-1',
      pagination: { page: 0, perPage: 10 },
    });
    expect(result.scores).toHaveLength(0);
  });
});
