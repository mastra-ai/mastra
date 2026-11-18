/**
 * DurableAgent detaches the caller's abort signal when it releases a run (#30754).
 *
 * `createRunAbortController` forwards a caller-supplied signal onto the run's own
 * controller by registering an `abort` listener on the caller's signal. stream(),
 * recover() and generate() used to drop the returned `detach`, so that listener
 * outlived the run. A caller that passes a composite signal — an idle loop's
 * `AbortSignal.any([segmentSignal, budgetSignal])` — then leaves Node holding the
 * composite in its persistent-signal set, one per turn, and with it the finished
 * run's session and request context.
 *
 * These tests spy on the caller's signal and assert the forwarder is removed when
 * the run's state is released, across every release path: the auto-cleanup the
 * stream bus arms when a run finishes (the idle-loop path), an explicit
 * `cleanup()`, `generate()`'s own release, and `recover()`'s release closure.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { MockStore } from '../../../storage/mock';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';
import { globalRunRegistry } from '../run-registry';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'Be brief.',
    model: createTextModel('done') as LanguageModelV2,
  });
}

/** The single `abort` listener installed on the caller's signal. */
function forwardedAbort(addListener: ReturnType<typeof vi.spyOn>) {
  return addListener.mock.calls.find(([type]) => type === 'abort')?.[1];
}

describe('DurableAgent detaches the caller abort listener', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  it('detaches when the auto-cleanup fires after a completed stream()', async () => {
    const durableAgent = createDurableAgent({ agent: createAgent('abort-detach-auto-agent'), pubsub });
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { abortDetachAutoAgent: durableAgent },
    });

    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const scheduleCleanup = vi.spyOn(durableAgent.__getStreamBus(), 'scheduleCleanup');
    const onFinish = vi.fn();

    const result = await durableAgent.stream('hi', { abortSignal: controller.signal, onFinish });
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(scheduleCleanup).toHaveBeenCalled());

    const forwarder = forwardedAbort(addListener);
    expect(forwarder).toBeDefined();
    // The turn finished but its state is still held for the grace period, which
    // is exactly the moment an idle loop's next turn starts.
    expect(removeListener).not.toHaveBeenCalledWith('abort', forwarder);

    // Fire the grace-period timer the bus armed when the run finished.
    for (const [cleanup] of scheduleCleanup.mock.calls) cleanup();

    expect(removeListener).toHaveBeenCalledWith('abort', forwarder);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('detaches when the caller cleans up a completed stream()', async () => {
    const durableAgent = createDurableAgent({ agent: createAgent('abort-detach-cleanup-agent'), pubsub });
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { abortDetachCleanupAgent: durableAgent },
    });

    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const onFinish = vi.fn();

    const result = await durableAgent.stream('hi', { abortSignal: controller.signal, onFinish });
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));

    const forwarder = forwardedAbort(addListener);
    expect(forwarder).toBeDefined();
    expect(removeListener).not.toHaveBeenCalledWith('abort', forwarder);

    await result.cleanup();

    expect(removeListener).toHaveBeenCalledWith('abort', forwarder);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('detaches when generate() releases the run', async () => {
    const durableAgent = createDurableAgent({ agent: createAgent('abort-detach-generate-agent'), pubsub });
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { abortDetachGenerateAgent: durableAgent },
    });

    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    const out = await durableAgent.generate('hi', { abortSignal: controller.signal });
    expect(out.runId).toBeDefined();

    const forwarder = forwardedAbort(addListener);
    expect(forwarder).toBeDefined();
    // generate() owns the run and tears it down on its way out.
    expect(removeListener).toHaveBeenCalledWith('abort', forwarder);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('detaches when recover() releases the recovered run', async () => {
    const store = new InMemoryStore();
    const durableAgent = createDurableAgent({ agent: createAgent('abort-detach-recover-agent'), pubsub });
    new Mastra({ logger: false, storage: store, agents: { abortDetachRecoverAgent: durableAgent } });

    // Recover()'s background restart is stubbed so it settles deterministically:
    // this test is about what recover() releases, not about re-driving a workflow.
    const restart = vi.fn(async () => ({ status: 'success' }));
    const createRun = vi.fn(async ({ runId }: { runId: string }) => ({ restart, runId }));
    vi.spyOn(durableAgent, 'getWorkflow').mockReturnValue({
      createRun,
      restart,
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);

    const runId = 'abort-detach-recover-run';
    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
      resourceId: 'abort-detach-resource',
      snapshot: {
        runId,
        status: 'running',
        value: {},
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            agentId: durableAgent.id,
            messageListState: { memoryInfo: { threadId: 'abort-detach-thread', resourceId: 'abort-detach-resource' } },
            state: { threadId: 'abort-detach-thread', resourceId: 'abort-detach-resource' },
          },
        },
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as unknown as WorkflowRunState,
    });

    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    const result = await durableAgent.recover(runId, { abortSignal: controller.signal });
    await durableAgent.runRegistry.get(runId)?.workflowExecution;
    result.cleanup();

    const forwarder = forwardedAbort(addListener);
    expect(forwarder).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith('abort', forwarder);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
