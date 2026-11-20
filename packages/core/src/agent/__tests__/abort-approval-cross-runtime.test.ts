/**
 * An aborted approval must not be resumable from another runtime (see #29267).
 *
 * The resume fence that stops an aborted run from being resumed lives in the
 * process that aborted it, so a peer runtime sharing the same snapshot storage
 * keeps listing the suspended run when the abort's snapshot cleanup fails. The
 * abort therefore marks the `agentic-loop` row `canceled` before deleting it;
 * that durable marker is what the peer refuses to resume.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const AGENTIC_LOOP_WORKFLOW_ID = 'agentic-loop';

function createMockModel() {
  let callCount = 0;
  const finish = (finishReason: 'tool-calls' | 'stop') => ({
    type: 'finish' as const,
    finishReason,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  });
  const stream = (chunks: any[]) => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
      ...chunks,
    ]),
  });
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return stream([
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'archiveItem',
            input: '{"id":"item-1"}',
            providerExecuted: false,
          },
          finish('tool-calls'),
        ]);
      }
      return stream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Archived' },
        { type: 'text-end', id: 'text-1' },
        finish('stop'),
      ]);
    },
    doGenerate: async () => {
      const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
      const rawCall = { rawPrompt: null, rawSettings: {} };
      return { rawCall, warnings: [], finishReason: 'stop', usage, content: [{ type: 'text', text: 'Archived' }] };
    },
  });
}

/**
 * Two runtimes on one shared snapshot storage, each with its own PubSub and its
 * own Agent instance under the same agent id (separate Mastra registries). That
 * is the cross-process case: neither runtime can see the other's resume fence.
 */
async function setup() {
  const storage = new InMemoryStore();
  const execute = vi.fn(async ({ id }: { id: string }) => ({ archived: id }));

  const createRuntime = async () => {
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'cross-runtime-approval-agent',
      name: 'Archive Agent',
      instructions: 'You archive items.',
      model: createMockModel(),
      tools: {
        archiveItem: createTool({
          id: 'archive_item',
          description: 'Archives an item',
          inputSchema: z.object({ id: z.string() }),
          requireApproval: true,
          execute,
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage, pubsub });
    const registered = mastra.getAgent('agent');
    return { agent: registered, pubsub };
  };

  const runtimeA = await createRuntime();
  const runtimeB = await createRuntime();
  const workflowsStore = (await storage.getStore('workflows'))!;
  return { execute, runtimeA, runtimeB, workflowsStore };
}

type Runtime = Awaited<ReturnType<typeof setup>>['runtimeA'];

async function suspendOn(runtime: Runtime) {
  const stream = await runtime.agent.stream('Archive item-1', { requireToolApproval: true });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
      break;
    }
  }
  expect(toolCallId).toBeTruthy();
  return { runId: stream.runId!, toolCallId };
}

describe('an aborted approval cannot be resumed from another runtime', () => {
  it('refuses the resume in both runtimes when the snapshot cleanup fails', async () => {
    const { execute, runtimeA, runtimeB, workflowsStore } = await setup();

    const { runId, toolCallId } = await suspendOn(runtimeA);

    // Fail only the loop row's delete, and restore the real one immediately so the
    // cleanup of every other workflow name runs normally. The abort's cleanup is
    // fire-and-forget, so signal when it runs instead of polling.
    let signalCleanupAttempted = () => {};
    const cleanupAttempted = new Promise<void>(resolve => (signalCleanupAttempted = resolve));
    const deleteRun = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
    workflowsStore.deleteWorkflowRunById = async args => {
      if (args.workflowName === AGENTIC_LOOP_WORKFLOW_ID) {
        workflowsStore.deleteWorkflowRunById = deleteRun;
        signalCleanupAttempted();
        throw new Error('snapshot store unavailable');
      }
      return deleteRun(args);
    };

    expect(runtimeA.agent.abortRunStream(runId)).toBe(true);
    await cleanupAttempted;
    // Let the failed delete settle before resuming.
    await new Promise(resolve => setImmediate(resolve));

    // The aborting runtime's own in-process fence rejects the resume.
    await expect(runtimeA.agent.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: 'AGENT_RESUME_ABORTED_RUN',
    });

    // The peer never saw that fence: it must refuse on the stored marker alone
    // instead of listing the run and executing the suspended tool.
    expect((await runtimeB.agent.listSuspendedRuns({})).runs).toHaveLength(0);
    await expect(runtimeB.agent.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: 'AGENT_RESUME_ABORTED_RUN',
    });

    expect(execute).not.toHaveBeenCalled();
    // The surviving row is the tombstone that stopped the peer.
    expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId })).toBe(
      'canceled',
    );
  }, 30000);

  it('drops the suspended run for the other runtime when the snapshot cleanup succeeds', async () => {
    const { execute, runtimeA, runtimeB, workflowsStore } = await setup();

    const { runId, toolCallId } = await suspendOn(runtimeA);

    expect(runtimeA.agent.abortRunStream(runId)).toBe(true);

    await vi.waitFor(async () => {
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId })).toBeNull();
    });

    expect((await runtimeB.agent.listSuspendedRuns({})).runs).toHaveLength(0);
    await expect(runtimeB.agent.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: expect.stringMatching(/^AGENT_RESUME_(ABORTED_RUN|NO_SNAPSHOT_FOUND)$/),
    });

    expect(execute).not.toHaveBeenCalled();
  }, 30000);
});
