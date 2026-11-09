import { describe, expect, it } from 'vitest';

import { seedExperimentDatasets } from '../../../src/mastra/evaluation/datasets.js';
import { runNativeExperiment } from '../../../src/mastra/evaluation/experiments.js';

import { openRuntime } from './helpers/runtime.js';

describe('Native comparable experiments', () => {
  it('agent experiments preserve grounded answer contract', async () => {
    let answerDispatches = 0;
    const answerUsage: Array<{ inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined> = [];
    const fixture = await openRuntime({
      onAnswerDispatch: () => {
        answerDispatches++;
      },
      onAnswerUsage: usage => {
        answerUsage.push(usage);
      },
    });
    try {
      const seeded = await seedExperimentDatasets(fixture.runtime);
      const dispatches: string[] = [];
      let created: { id: string; datasetVersion: number } | undefined;
      const run = await runNativeExperiment(fixture.runtime, {
        family: 'agent',
        version: seeded.agentVersion,
        onExperimentCreated: experiment => {
          created = experiment;
        },
        onItemDispatched: itemId => {
          dispatches.push(itemId);
        },
      });
      expect(run).toMatchObject({ status: 'completed', completedItemIds: expect.any(Array), storageComplete: true });
      expect(run.completedItemIds).toHaveLength(30);
      expect(created).toEqual({ id: run.experimentId, datasetVersion: run.datasetVersion });
      expect(dispatches).toEqual(run.completedItemIds);
      expect(fixture.counters).toMatchObject({ answer: 30, judge: 30 });
      expect(answerDispatches).toBe(30);
      expect(answerUsage).toEqual(
        Array.from({ length: 30 }, () => ({ inputTokens: 1, outputTokens: 1, totalTokens: 2 })),
      );
      expect(fixture.counters.answerRequests).toHaveLength(30);
      expect(fixture.counters.answerRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ abortSignal: expect.any(AbortSignal), maxOutputTokens: 4096 }),
        ]),
      );
      expect(fixture.counters.answerRequests.every(request => request.maxOutputTokens === 4096)).toBe(true);
      expect(fixture.runtime.observations.size).toBe(30);
      expect(
        [...fixture.runtime.observations.values()].filter(item => item.answer.status === 'insufficient_evidence'),
      ).toHaveLength(5);
      expect(
        [...fixture.runtime.observations.values()].filter(item => item.answer.status === 'conflicting_evidence'),
      ).toHaveLength(3);
      expect(
        [...fixture.runtime.observations.values()].filter(
          item => item.answer.status === 'answered' && item.answer.answer.includes('document instruction'),
        ),
      ).toHaveLength(2);
      expect(fixture.counters.prompts.join('\n')).not.toContain('requiredRecordIds');
      expect(fixture.counters.prompts.join('\n')).not.toContain('requiredFacts');
    } finally {
      await fixture.close();
    }
    const invalid = await openRuntime({ invalidAnswerFor: 'How long are invoices retained?' });
    try {
      const seeded = await seedExperimentDatasets(invalid.runtime);
      await expect(
        runNativeExperiment(invalid.runtime, { family: 'agent', version: seeded.agentVersion }),
      ).resolves.toMatchObject({
        status: 'completed',
      });
      const invalidAnswer = [...invalid.runtime.observations.values()].find(
        item => item.answer.metadata.validationFailure === 'invalid_status_or_draft',
      );
      expect(invalidAnswer?.answer).toMatchObject({ status: 'operational_error', citations: [] });
      expect(invalid.counters).toMatchObject({ answer: 30, judge: 30 });
    } finally {
      await invalid.close();
    }
  });
});
