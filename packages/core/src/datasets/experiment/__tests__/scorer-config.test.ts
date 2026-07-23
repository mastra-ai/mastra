import { describe, expect, it, vi } from 'vitest';
import type { MastraScorer } from '../../../evals/base';
import type { Mastra } from '../../../mastra';
import { normalizeExperimentScorers } from '../scorer';

function createScorer(id: string, type?: 'trajectory'): MastraScorer<any, any, any, any> {
  return {
    id,
    name: id,
    description: `${id} scorer`,
    ...(type ? { type } : {}),
    run: vi.fn(),
  } as unknown as MastraScorer<any, any, any, any>;
}

function createMastra(scorers: MastraScorer<any, any, any, any>[]): Mastra {
  const byId = new Map(scorers.map(scorer => [scorer.id, scorer]));
  return {
    getScorerById: vi.fn((id: string) => byId.get(id)),
  } as unknown as Mastra;
}

describe('normalizeExperimentScorers', () => {
  it('merges dataset scorers and snapshots flat threshold entries', () => {
    const inline = createScorer('inline');
    const registered = createScorer('registered');
    const dataset = createScorer('dataset');
    const mastra = createMastra([registered, dataset]);

    const result = normalizeExperimentScorers(
      mastra,
      [inline, { scorer: 'registered', threshold: { min: 0.7, max: 0.9 } }],
      ['registered', 'dataset'],
    );

    expect(result.scorers.map(scorer => scorer.id)).toEqual(['inline', 'registered', 'dataset']);
    expect(result.thresholds).toEqual([
      {
        scorerId: 'registered',
        threshold: { min: 0.7, max: 0.9 },
        targetScope: 'span',
      },
    ]);
  });

  it('keeps trajectory and workflow-step threshold identities distinct', () => {
    const shared = createScorer('shared');
    const trajectory = createScorer('trajectory', 'trajectory');
    const mastra = createMastra([shared, trajectory]);

    const result = normalizeExperimentScorers(mastra, {
      workflow: [{ scorer: 'shared', threshold: 0.6 }],
      trajectory: [{ scorer: 'trajectory', threshold: 0.8 }],
      steps: {
        draft: [{ scorer: 'shared', threshold: { min: 0.7 } }],
      },
    });

    expect(result.thresholds).toEqual([
      { scorerId: 'shared', threshold: 0.6, targetScope: 'span' },
      { scorerId: 'trajectory', threshold: 0.8, targetScope: 'trajectory' },
      { scorerId: 'shared', threshold: { min: 0.7 }, targetScope: 'span', stepId: 'draft' },
    ]);
    expect(result.stepScorers.draft?.map(scorer => scorer.id)).toEqual(['shared']);
  });

  it('rejects invalid and ambiguous threshold bindings', () => {
    const scorer = createScorer('quality');
    const mastra = createMastra([scorer]);

    expect(() =>
      normalizeExperimentScorers(mastra, [{ scorer: 'quality', threshold: { min: 0.8, max: 0.2 } }]),
    ).toThrow('min (0.8) greater than max (0.2)');

    expect(() =>
      normalizeExperimentScorers(mastra, [
        { scorer: 'quality', threshold: 0.5 },
        { scorer: 'quality', threshold: 0.7 },
      ]),
    ).toThrow('Multiple thresholds were configured for scorer "quality"');
  });
});
