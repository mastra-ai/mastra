import { describe, expect, it } from 'vitest';

import { seedExperimentDatasets } from '../../../src/mastra/evaluation/datasets.js';
import { runNativeExperiment } from '../../../src/mastra/evaluation/experiments.js';

import { openRuntime } from './helpers/runtime.js';

describe('Native comparable experiments', () => {
  it('provider expiry and timeout are non successes without retry', async () => {
    const expiryDispatches: string[] = [];
    const expiryUsage: Array<{ inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined> = [];
    let expiredExperimentId: string | undefined;
    const expired = await openRuntime({
      answerError: () => new Error('synthetic-expired-credential'),
      onAnswerDispatch: () => {
        expiryDispatches.push('dispatch');
      },
      onAnswerUsage: usage => {
        expiryUsage.push(usage);
      },
    });
    try {
      const seeded = await seedExperimentDatasets(expired.runtime);
      await expect(
        runNativeExperiment(expired.runtime, {
          family: 'agent',
          version: seeded.agentVersion,
          onExperimentCreated: experiment => {
            expiredExperimentId = experiment.id;
          },
        }),
      ).rejects.toThrow('storage was incomplete');
      expect(expiredExperimentId).toEqual(expect.any(String));
      expect(expiryDispatches).toEqual(['dispatch']);
      expect(expiryUsage).toEqual([undefined]);
      expect(expired.counters.answer).toBe(1);
      expect(expired.counters.judge).toBe(0);
    } finally {
      await expired.close();
    }

    const timedOut = await openRuntime({ providerTimeoutMs: 1, waitForAnswerAbort: true });
    try {
      const seeded = await seedExperimentDatasets(timedOut.runtime);
      await expect(
        runNativeExperiment(timedOut.runtime, { family: 'agent', version: seeded.agentVersion }),
      ).rejects.toThrow('storage was incomplete');
      expect(timedOut.counters.answer).toBe(1);
      expect(timedOut.counters.answerRequests[0]).toMatchObject({
        abortSignal: expect.objectContaining({ aborted: true }),
        maxOutputTokens: 4096,
      });
      expect(timedOut.counters.judge).toBe(0);
    } finally {
      await timedOut.close();
    }
  });
});
