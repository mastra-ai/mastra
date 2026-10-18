/**
 * DurableAgent approval resume lifecycle: registry cleanup, abort, and segment ownership
 * across an approval resume. Resume-data forwarding (#24561) is covered on every engine by the
 * `approval-policy` aimock scenario.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

/** Creates a model that requests one tool call, then completes after the tool resumes. */
function createToolCallThenTextModel(
  tool: { name: string; args: object },
  abortOnResume = false,
  onResumeCall?: () => void,
) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async ({ abortSignal }) => {
      callCount++;
      if (callCount > 1 && abortOnResume) {
        onResumeCall?.();
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'id-1',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              abortSignal?.addEventListener(
                'abort',
                () => {
                  const error = new Error('Aborted');
                  error.name = 'AbortError';
                  controller.error(error);
                },
                { once: true },
              );
            },
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream(
          callCount === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: tool.name,
                  input: JSON.stringify(tool.args),
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('DurableAgent approval resume data', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  it('does not recreate the registry key when an evented approval stream is cleaned up before FINISH completes', async () => {
    const memory = new MockMemory();
    memory.getMergedThreadConfig = () => ({ generateTitle: true });

    const approvalTool = createTool({
      id: 'approvalTool',
      description: 'approval-gated tool',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async () => 'ok',
    });
    const baseAgent = new Agent({
      id: 'evented-approval-cleanup-agent',
      name: 'Evented Approval Cleanup Agent',
      instructions: 'Use the approval tool.',
      model: createToolCallThenTextModel({ name: 'approvalTool', args: { value: 'test' } }) as LanguageModelV2,
      memory,
      tools: { approvalTool },
    });
    let resolveTitle!: (title: string) => void;
    const titlePending = new Promise<string>(resolve => {
      resolveTitle = resolve;
    });
    const generateTitle = vi.spyOn(baseAgent, 'genTitle').mockReturnValue(titlePending);
    const eventedAgent = createEventedAgent({ agent: baseAgent, pubsub });
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { eventedApprovalCleanupAgent: eventedAgent },
    });

    let suspendedData: unknown;
    const initial = await eventedAgent.stream('Run the approval tool', {
      memory: { thread: 'evented-approval-cleanup-thread', resource: 'evented-approval-cleanup-resource' },
      onSuspended: data => {
        suspendedData = data;
      },
    });
    await vi.waitFor(() => expect(suspendedData).toMatchObject({ type: 'approval', toolCallId: 'call-1' }));

    let finishData: unknown;
    const resumed = await eventedAgent.resume(
      initial.runId,
      { approved: true },
      {
        onFinish: data => {
          finishData = data;
        },
      },
    );
    await vi.waitFor(() => expect(finishData).toBeDefined());
    expect(generateTitle).toHaveBeenCalledTimes(1);

    const workflowExecution = globalRunRegistry.get(initial.runId)?.workflowExecution;
    expect(workflowExecution).toBeDefined();

    resumed.cleanup();
    initial.cleanup();

    resolveTitle('Generated title');
    await workflowExecution;

    await vi.waitFor(() => expect([...globalRunRegistry.keys()]).not.toContain(initial.runId));
    await new Promise(r => setTimeout(r, 50));
    expect([...globalRunRegistry.keys()]).not.toContain(initial.runId);
  });

  it('invokes onAbort when a resumed run is aborted', async () => {
    let resumeModelStarted!: () => void;
    const resumeModelStartedPromise = new Promise<void>(resolve => {
      resumeModelStarted = resolve;
    });
    const approvalTool = createTool({
      id: 'approvalTool',
      description: 'approval-gated tool',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async () => 'ok',
    });
    const baseAgent = new Agent({
      id: 'approval-resume-abort-agent',
      name: 'Approval Resume Abort Agent',
      instructions: 'Use the approval tool.',
      model: createToolCallThenTextModel(
        { name: 'approvalTool', args: { value: 'test' } },
        true,
        resumeModelStarted,
      ) as LanguageModelV2,
      tools: { approvalTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({ logger: false, storage: new MockStore(), agents: { approvalResumeAbortAgent: durableAgent } });

    let suspendedData: unknown;
    const initial = await durableAgent.stream('Run the approval tool', {
      onSuspended: data => {
        suspendedData = data;
      },
    });
    await vi.waitFor(() => expect(suspendedData).toBeDefined());

    const onAbort = vi.fn();
    const onFinish = vi.fn();
    const resumed = await durableAgent.resume(initial.runId, { approved: true }, { onAbort, onFinish });
    await resumeModelStartedPromise;
    resumed.abort();
    await resumed.output.consumeStream().catch(() => undefined);

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    resumed.cleanup();
    initial.cleanup();
  });

  it("does not let the first segment's cleanup tear down a resumed segment", async () => {
    let resumeModelStarted!: () => void;
    const resumeModelStartedPromise = new Promise<void>(resolve => {
      resumeModelStarted = resolve;
    });
    const approvalTool = createTool({
      id: 'approvalTool',
      description: 'approval-gated tool',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async () => 'ok',
    });
    const baseAgent = new Agent({
      id: 'approval-segment-owner-agent',
      name: 'Approval Segment Owner Agent',
      instructions: 'Use the approval tool.',
      model: createToolCallThenTextModel(
        { name: 'approvalTool', args: { value: 'test' } },
        true,
        resumeModelStarted,
      ) as LanguageModelV2,
      tools: { approvalTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({ logger: false, storage: new MockStore(), agents: { approvalSegmentOwnerAgent: durableAgent } });

    let suspendedData: unknown;
    const initial = await durableAgent.stream('Run the approval tool', {
      onSuspended: data => {
        suspendedData = data;
      },
    });
    await vi.waitFor(() => expect(suspendedData).toBeDefined());

    const resumed = await durableAgent.resume(initial.runId, { approved: true });
    await resumeModelStartedPromise;

    initial.cleanup();
    await new Promise(r => setTimeout(r, 100));
    expect(globalRunRegistry.get(initial.runId)).toBeDefined();
    expect(durableAgent.runRegistry.has(initial.runId)).toBe(true);

    resumed.abort();
    await resumed.output.consumeStream().catch(() => undefined);
    resumed.cleanup();
    await vi.waitFor(() => expect(globalRunRegistry.get(initial.runId)).toBeUndefined());
  });

  it('releases the run when resume setup fails', async () => {
    const approvalTool = createTool({
      id: 'approvalTool',
      description: 'approval-gated tool',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async () => 'ok',
    });
    const baseAgent = new Agent({
      id: 'approval-resume-fail-agent',
      name: 'Approval Resume Fail Agent',
      instructions: 'Use the approval tool.',
      model: createToolCallThenTextModel({ name: 'approvalTool', args: { value: 'test' } }) as LanguageModelV2,
      tools: { approvalTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const storage = new MockStore();
    new Mastra({ logger: false, storage, agents: { approvalResumeFailAgent: durableAgent } });

    let suspendedData: unknown;
    const initial = await durableAgent.stream('Run the approval tool', {
      onSuspended: data => {
        suspendedData = data;
      },
    });
    await vi.waitFor(() => expect(suspendedData).toBeDefined());

    const workflows = (await storage.getStore('workflows'))!;
    vi.spyOn(workflows, 'getWorkflowRunById').mockRejectedValue(new Error('storage down'));
    await expect(durableAgent.resume(initial.runId, { approved: true })).rejects.toThrow('storage down');

    initial.cleanup();
    await vi.waitFor(() => {
      expect(globalRunRegistry.has(initial.runId)).toBe(false);
      expect(durableAgent.runRegistry.has(initial.runId)).toBe(false);
    });
  });
});
