import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';

import { ObservationStrategy } from '../observation-strategies/base';
import type { StrategyDeps } from '../observation-strategies/base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from '../observation-strategies/types';

type PersistOutcome = 'commit' | 'skip' | 'fail';

/** Strategy whose persist step commits, skips, or fails, exposing the commit settlement hooks receive. */
class CommitStrategy extends ObservationStrategy {
  constructor(
    deps: StrategyDeps,
    opts: ObservationRunOpts,
    private readonly outcome: PersistOutcome,
  ) {
    super(deps, opts);
  }
  get needsLock() {
    return false;
  }
  get needsReflection() {
    return false;
  }
  get rethrowOnFailure() {
    return false;
  }
  get committed() {
    return this.observationCommitted;
  }
  async prepare(): Promise<{ messages: MastraDBMessage[]; existingObservations: string }> {
    return { messages: [], existingObservations: '' };
  }
  async observe(): Promise<ObserverOutput> {
    return { observations: 'User confirmed the launch date.' };
  }
  async process(output: ObserverOutput): Promise<ProcessedObservation> {
    return {
      observations: output.observations,
      observationTokens: 1,
      cycleObservationTokens: 1,
      observedMessageIds: [],
      lastObservedAt: new Date(),
    };
  }
  async persist(): Promise<boolean> {
    if (this.outcome === 'fail') throw new Error('commit failed');
    return this.outcome === 'commit';
  }
  async emitStartMarkers(): Promise<void> {}
  async emitEndMarkers(): Promise<void> {}
  async emitFailedMarkers(): Promise<void> {}
}

function createStrategy(outcome: PersistOutcome) {
  const deps = {
    storage: { listMessages: vi.fn().mockResolvedValue({ messages: [] }) },
    messageHistory: { persistMessages: vi.fn().mockResolvedValue(undefined) },
    tokenCounter: {},
    observationConfig: { messageTokens: 1000 },
    reflectionConfig: { observationTokens: 1000 },
    scope: 'thread',
    retrieval: false,
  } as unknown as StrategyDeps;
  const opts = {
    record: { id: 'record-1' } as ObservationRunOpts['record'],
    threadId: 'commit-thread',
    resourceId: 'commit-resource',
    messages: [],
  } as ObservationRunOpts;
  return new CommitStrategy(deps, opts, outcome);
}

describe('Observation commit settlement', () => {
  it('settles true once the cycle commits its observations', async () => {
    const strategy = createStrategy('commit');

    await expect(strategy.run()).resolves.toMatchObject({ observed: true });

    await expect(strategy.committed).resolves.toBe(true);
  });

  it('settles false when the cycle skips its commit', async () => {
    const strategy = createStrategy('skip');

    await strategy.run();

    await expect(strategy.committed).resolves.toBe(false);
  });

  it('settles false without rejecting when the commit fails', async () => {
    const strategy = createStrategy('fail');

    await expect(strategy.run()).resolves.toMatchObject({ observed: false });

    await expect(strategy.committed).resolves.toBe(false);
  });
});
