import { describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';
import { InMemoryStore } from '../../storage/mock';

import { beginGoalActivity, stopGoalActivity } from './activity';
import { GOAL_REQUEST_CONTEXT_KEY, GOAL_STATE_TYPE } from './objective';
import { GoalStateProcessor } from './state-processor';

const THREAD_ID = 'thread-1';

function objective(overrides: Partial<GoalObjectiveRecord> = {}): GoalObjectiveRecord {
  return {
    objective: 'Ship the feature',
    status: 'active',
    runsUsed: 0,
    maxRuns: 5,
    startedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

async function createProcessor(stored?: GoalObjectiveRecord) {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const store = await storage.getStore('threadState');
  if (stored) await store!.setState({ threadId: THREAD_ID, type: GOAL_STATE_TYPE, value: stored });
  const processor = new GoalStateProcessor();
  processor.__registerMastra(mastra as any);
  return { mastra, processor, storage, store: store! };
}

function snapshotSignal(record: GoalObjectiveRecord) {
  return { metadata: { value: { objective: record } } } as any;
}

function createArgs(options: {
  carried?: GoalObjectiveRecord | null;
  lastSnapshot?: GoalObjectiveRecord;
  hasSnapshot?: boolean;
  requestContext?: RequestContext;
}) {
  const requestContext = options.requestContext ?? new RequestContext();
  if (options.carried !== undefined) {
    requestContext.set(GOAL_REQUEST_CONTEXT_KEY, options.carried === null ? undefined : options.carried);
  }
  return {
    threadId: THREAD_ID,
    resourceId: 'resource-1',
    messages: [],
    requestContext,
    contextWindow: { hasSnapshot: options.hasSnapshot ?? true },
    lastSnapshot: options.lastSnapshot ? snapshotSignal(options.lastSnapshot) : undefined,
    activeStateSignals: [],
    deltasSinceSnapshot: [],
  } as any;
}

describe('GoalStateProcessor', () => {
  it('emits a snapshot for an active objective (no base in window)', async () => {
    const { processor } = await createProcessor(objective());
    const result = await processor.computeStateSignal(createArgs({ hasSnapshot: false }));

    expect(result).toBeTruthy();
    expect(result!.mode).toBe('snapshot');
    expect(result!.tagName).toBe('current-objective');
    expect(result!.contents).toContain('Ship the feature');
    expect(result!.attributes).toMatchObject({ status: 'active', runsUsed: 0, maxRuns: 5 });
  });

  it('emits nothing when unchanged and the base is still in window', async () => {
    const { processor } = await createProcessor(objective());
    const result = await processor.computeStateSignal(createArgs({ lastSnapshot: objective(), hasSnapshot: true }));
    expect(result).toBeUndefined();
  });

  it('re-emits when the objective changes', async () => {
    const { processor } = await createProcessor(objective({ runsUsed: 2 }));
    const result = await processor.computeStateSignal(
      createArgs({ lastSnapshot: objective({ runsUsed: 0 }), hasSnapshot: true }),
    );
    expect(result).toBeTruthy();
    expect(result!.attributes).toMatchObject({ runsUsed: 2 });
  });

  it('re-snapshots when the base was dropped from the window', async () => {
    const { processor } = await createProcessor(objective());
    const result = await processor.computeStateSignal(createArgs({ lastSnapshot: objective(), hasSnapshot: false }));
    expect(result).toBeTruthy();
    expect(result!.mode).toBe('snapshot');
  });

  it('emits nothing for a non-active objective', async () => {
    const { processor } = await createProcessor(objective({ status: 'done' }));
    const result = await processor.computeStateSignal(createArgs({ hasSnapshot: false }));
    expect(result).toBeUndefined();
  });

  it('prefers the within-turn objective carried on the request context', async () => {
    const { processor } = await createProcessor(objective({ objective: 'stored' }));
    const result = await processor.computeStateSignal(
      createArgs({ carried: objective({ objective: 'carried' }), hasSnapshot: false }),
    );
    expect(result!.contents).toContain('carried');
  });

  it('emits nothing when the objective was cleared this turn', async () => {
    const { processor } = await createProcessor(objective());
    const result = await processor.computeStateSignal(createArgs({ carried: null, hasSnapshot: false }));
    expect(result).toBeUndefined();
  });

  it('retracts a stale snapshot when the objective is no longer active but a base is in window', async () => {
    const { processor } = await createProcessor(objective({ status: 'done' }));
    const result = await processor.computeStateSignal(createArgs({ lastSnapshot: objective(), hasSnapshot: true }));

    expect(result).toBeTruthy();
    expect(result!.mode).toBe('snapshot');
    expect(result!.tagName).toBe('current-objective');
    expect(result!.contents).not.toContain('Ship the feature');
    expect(result!.attributes).toMatchObject({ status: 'none' });
    expect((result!.metadata as any).value.objective).toBeUndefined();
  });

  it('retracts a stale snapshot when the objective was cleared this turn but a base is in window', async () => {
    const { processor } = await createProcessor(objective());
    const result = await processor.computeStateSignal(
      createArgs({ carried: null, lastSnapshot: objective(), hasSnapshot: true }),
    );

    expect(result).toBeTruthy();
    expect(result!.attributes).toMatchObject({ status: 'none' });
  });

  it('does not re-emit the retraction once the base snapshot is already empty', async () => {
    const { processor } = await createProcessor(objective({ status: 'done' }));
    // No prior objective in the last snapshot (already retracted) — nothing to do.
    const result = await processor.computeStateSignal(createArgs({ hasSnapshot: true }));
    expect(result).toBeUndefined();
  });

  it('reuses the objective resolved by activity tracking', async () => {
    const { mastra, processor, store } = await createProcessor(objective());
    const requestContext = new RequestContext();
    const getState = vi.spyOn(store, 'getState');

    await beginGoalActivity({
      mastra,
      agentId: 'goal-agent',
      threadId: THREAD_ID,
      runId: 'cached-objective-run',
      requestContext,
    });
    const result = await processor.computeStateSignal(createArgs({ hasSnapshot: false, requestContext }));

    expect(result?.contents).toContain('Ship the feature');
    expect(getState).toHaveBeenCalledTimes(1);

    await processor.computeStateSignal(createArgs({ hasSnapshot: false, requestContext }));
    expect(getState).toHaveBeenCalledTimes(2);
    await stopGoalActivity({ agentId: 'goal-agent', runId: 'cached-objective-run' });
  });

  it('prefers a within-turn objective write over the activity cache', async () => {
    const { mastra, processor } = await createProcessor(objective({ objective: 'Stored objective' }));
    const requestContext = new RequestContext();

    await beginGoalActivity({
      mastra,
      agentId: 'goal-agent',
      threadId: THREAD_ID,
      runId: 'cached-stale-run',
      requestContext,
    });
    requestContext.set(GOAL_REQUEST_CONTEXT_KEY, objective({ objective: 'New within-turn objective' }));
    const result = await processor.computeStateSignal(createArgs({ hasSnapshot: false, requestContext }));

    expect(result?.contents).toContain('New within-turn objective');
    expect(result?.contents).not.toContain('Stored objective');
    await stopGoalActivity({ agentId: 'goal-agent', runId: 'cached-stale-run' });
  });

  it('reuses a cached missing objective without reading storage again', async () => {
    const { mastra, processor, store } = await createProcessor();
    const requestContext = new RequestContext();
    const getState = vi.spyOn(store, 'getState');

    await beginGoalActivity({
      mastra,
      agentId: 'goal-agent',
      threadId: THREAD_ID,
      runId: 'cached-empty-run',
      requestContext,
    });
    const result = await processor.computeStateSignal(createArgs({ hasSnapshot: false, requestContext }));

    expect(result).toBeUndefined();
    expect(getState).toHaveBeenCalledTimes(1);
  });
});
