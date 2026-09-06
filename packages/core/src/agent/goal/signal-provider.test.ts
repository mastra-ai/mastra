import { describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
// Import via the `@mastra/core/signals` barrel (not the local goal barrel) so
// this also exercises that the public signals barrel can pull
// GoalSignalProvider without a broken export or initialization cycle.
import { GoalSignalProvider } from '../../signals/index';
import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';
import { InMemoryStore } from '../../storage/mock';

import { GOAL_STATE_TYPE } from './objective';
import { GoalStateProcessor } from './state-processor';

function activeObjective(text: string): GoalObjectiveRecord {
  return {
    objective: text,
    status: 'active',
    runsUsed: 0,
    maxRuns: 5,
    startedAt: 0,
    updatedAt: 0,
  };
}

function computeArgs(threadId: string) {
  return {
    threadId,
    resourceId: 'resource-1',
    messages: [],
    requestContext: new RequestContext(),
    contextWindow: { hasSnapshot: false },
    activeStateSignals: [],
    deltasSinceSnapshot: [],
  } as any;
}

describe('GoalSignalProvider', () => {
  it('has a stable id', () => {
    expect(new GoalSignalProvider().id).toBe('goal-signals');
  });

  it('exposes a single GoalStateProcessor input processor', () => {
    const processors = new GoalSignalProvider().getInputProcessors();
    expect(processors).toHaveLength(1);
    expect(processors[0]).toBeInstanceOf(GoalStateProcessor);
  });

  it('returns the same processor instance across calls (stable lane)', () => {
    const provider = new GoalSignalProvider();
    expect(provider.getInputProcessors()[0]).toBe(provider.getInputProcessors()[0]);
  });

  it('forwards the Mastra instance to its state processor so the store resolves', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ storage, logger: false });
    const store = await storage.getStore('threadState');
    await store!.setState({ threadId: 'thread-1', type: GOAL_STATE_TYPE, value: activeObjective('Ship it') });

    const provider = new GoalSignalProvider();
    provider.__registerMastra(mastra as any);

    const result = await (provider.getInputProcessors()[0] as GoalStateProcessor).computeStateSignal(
      computeArgs('thread-1'),
    );
    expect(result?.contents).toContain('Ship it');
  });

  // Regression for #22446: `GoalStateProcessor` hardcodes its id, so two agents
  // collide on the Mastra processor registry key and `addProcessor` early-returns
  // for the second one — which used to leave it without a Mastra, and therefore
  // without a store, forever. Provider-level propagation must reach both.
  it('projects the objective for every provider sharing one Mastra instance', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ storage, logger: false });
    const store = await storage.getStore('threadState');
    await store!.setState({ threadId: 'thread-a', type: GOAL_STATE_TYPE, value: activeObjective('First goal') });
    await store!.setState({ threadId: 'thread-b', type: GOAL_STATE_TYPE, value: activeObjective('Second goal') });

    const first = new GoalSignalProvider();
    const second = new GoalSignalProvider();
    for (const provider of [first, second]) {
      provider.__registerMastra(mastra as any);
      // Mirrors agent registration: the shared registry key means only the first
      // processor is ever added to Mastra's processor map.
      mastra.addProcessor(provider.getInputProcessors()[0] as any);
    }

    const firstResult = await (first.getInputProcessors()[0] as GoalStateProcessor).computeStateSignal(
      computeArgs('thread-a'),
    );
    const secondResult = await (second.getInputProcessors()[0] as GoalStateProcessor).computeStateSignal(
      computeArgs('thread-b'),
    );

    expect(firstResult?.contents).toContain('First goal');
    expect(secondResult?.contents).toContain('Second goal');
  });
});
