import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { InngestRun } from './run';

const subscribeMock = vi.fn();

describe('Inngest realtime subscriptions', () => {
  beforeEach(() => {
    vi.resetModules();
    subscribeMock.mockReset();
    vi.doMock('inngest/realtime', () => ({
      subscribe: subscribeMock,
    }));
  });

  afterEach(() => {
    vi.doUnmock('inngest/realtime');
    vi.resetModules();
  });

  it('uses callback-only subscriptions and closes after the final PubSub callback unsubscribes', async () => {
    const { InngestPubSub } = await import('./pubsub');
    const close = vi.fn();
    subscribeMock.mockResolvedValue({ close });
    const pubsub = new InngestPubSub(new Inngest({ id: 'pubsub-subscription-test' }), 'workflow-id');
    const first = vi.fn();
    const second = vi.fn();

    await pubsub.subscribe('agent.stream.run-id', first);
    await pubsub.subscribe('agent.stream.run-id', second);

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'agent:run-id',
        topics: ['agent-stream'],
        onMessage: expect.any(Function),
      }),
    );

    await pubsub.unsubscribe('agent.stream.run-id', first);
    expect(close).not.toHaveBeenCalled();

    await pubsub.unsubscribe('agent.stream.run-id', second);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes a pending run-output subscription after polling wins', async () => {
    const { init } = await import('./index');
    let resolveSubscription!: (subscription: { close: () => void }) => void;
    subscribeMock.mockReturnValue(
      new Promise(resolve => {
        resolveSubscription = resolve;
      }),
    );

    const inngest = new Inngest({ id: 'run-output-subscription-test' });
    const { createWorkflow, createStep } = init(inngest);
    const step = createStep({
      id: 'step',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      execute: async () => ({ done: true }),
    });
    const workflow = createWorkflow({
      id: 'run-output-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      steps: [step],
    })
      .then(step)
      .commit();
    const mastra = new Mastra({
      storage: new MockStore(),
      workflows: { 'run-output-workflow': workflow as any },
    });
    const run = (await workflow.createRun({ runId: 'run-output-run' })) as unknown as InngestRun;
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId: run.runId,
      snapshot: {
        runId: run.runId,
        status: 'success',
        result: { done: true },
        context: { input: {} } as any,
        value: {},
        activePaths: [],
        suspendedPaths: {},
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        serializedStepGraph: run.serializedStepGraph,
        timestamp: Date.now(),
      },
    });

    await expect(run.getRunOutput('event-id')).resolves.toMatchObject({
      output: { result: { status: 'success', result: { done: true } } },
    });
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: `workflow:${workflow.id}:${run.runId}`,
        topics: ['watch'],
        onMessage: expect.any(Function),
      }),
    );

    const close = vi.fn();
    resolveSubscription({ close });
    await new Promise(resolve => setImmediate(resolve));

    expect(close).toHaveBeenCalledTimes(1);
  });
});
