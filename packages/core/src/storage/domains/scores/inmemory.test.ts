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
