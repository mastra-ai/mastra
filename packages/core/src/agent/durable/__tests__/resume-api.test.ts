/**
 * Resume API Tests
 *
 * Tests for the resume() method on DurableAgent.
 * Validates:
 * - Basic resume functionality
 * - Event replay during reconnection (using CachingPubSub)
 * - Context preservation (threadId, resourceId)
 * - Tool approval resume flow
 */

import { getEventListeners } from 'node:events';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { MastraFGAPermissions } from '../../../auth/ee';
import type { IFGAProvider } from '../../../auth/ee';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { PubSub } from '../../../events/pubsub';
import type { Event, EventCallback, SubscribeOptions } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';
import { globalRunRegistry } from '../run-registry';
import { emitChunkEvent, emitFinishEvent } from '../stream-adapter';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns a tool call that will suspend
 */
function createSuspendingToolModel(toolName: string, toolArgs: object) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(toolArgs),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a text-only model for after resume
 */
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
      warnings: [],
    }),
  });
}

function createSuspendingThenTextModel(toolName: string, texts: string[]) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      const chunks =
        call === 1
          ? [
              { type: 'stream-start' as const, warnings: [] },
              {
                type: 'response-metadata' as const,
                id: 'id-1',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-1',
                toolName,
                input: JSON.stringify({ action: 'continue' }),
                providerExecuted: false,
              },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]
          : (() => {
              const text = texts[call - 2];
              if (text === undefined) throw new Error(`Unexpected model call ${call}`);
              return [
                { type: 'stream-start' as const, warnings: [] },
                {
                  type: 'response-metadata' as const,
                  id: `id-${call}`,
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start' as const, id: `text-${call}` },
                { type: 'text-delta' as const, id: `text-${call}`, delta: text },
                { type: 'text-end' as const, id: `text-${call}` },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ];
            })();
      return {
        stream: convertArrayToReadableStream(chunks),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Calls `toolName` once per id in `toolCallIds`, one per model call, then answers `text`. */
function createToolCallSequenceModel(toolName: string, toolCallIds: string[], text: string) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const toolCallId = toolCallIds[call];
      call++;
      const chunks = toolCallId
        ? [
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId,
              toolName,
              input: JSON.stringify({ action: 'continue' }),
              providerExecuted: false,
            },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]
        : [
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start' as const, id: `text-${call}` },
            { type: 'text-delta' as const, id: `text-${call}`, delta: text },
            { type: 'text-end' as const, id: `text-${call}` },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ];
      return {
        stream: convertArrayToReadableStream(chunks),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Calls each tool in `calls`, one per model call, then answers `text`. */
function createMixedToolCallModel(calls: Array<{ toolName: string; toolCallId: string }>, text: string) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const next = calls[call];
      call++;
      const head = [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
      ];
      const body = next
        ? [
            {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: next.toolCallId,
              toolName: next.toolName,
              input: JSON.stringify({ action: 'continue' }),
              providerExecuted: false,
            },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]
        : [
            { type: 'text-start' as const, id: `text-${call}` },
            { type: 'text-delta' as const, id: `text-${call}`, delta: text },
            { type: 'text-end' as const, id: `text-${call}` },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ];
      return {
        stream: convertArrayToReadableStream([...head, ...body]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** The signed-in user a request carries, as Mastra's auth middleware sets it. */
function signedIn(id: string, role = 'member') {
  return new RequestContext<unknown>([['user', { id, role }]]);
}

function userIdOf(requestContext: RequestContext<unknown> | undefined): unknown {
  const user = requestContext?.get('user');
  return user && typeof user === 'object' && 'id' in user ? user.id : undefined;
}

function roleOf(requestContext: RequestContext<unknown> | undefined): unknown {
  const user = requestContext?.get('user');
  return user && typeof user === 'object' && 'role' in user ? user.role : undefined;
}

/** A promise with its resolver, for holding a tool resolver or tool until the test lets it go. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

async function drain(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

class RetainingPubSub extends PubSub {
  readonly history = new Map<string, Event[]>();
  readonly subscribers = new Map<string, Set<EventCallback>>();

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const retained = { ...event, id: crypto.randomUUID(), createdAt: new Date() };
    const history = this.history.get(topic) ?? [];
    history.push(retained);
    this.history.set(topic, history);

    for (const subscriber of this.subscribers.get(topic) ?? []) {
      await subscriber(retained, async () => {});
    }
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (options?.startFrom !== 'latest') {
      for (const event of this.history.get(topic) ?? []) {
        await cb(event, async () => {});
      }
    }

    const subscribers = this.subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.subscribers.get(topic)?.delete(cb);
  }

  async flush(): Promise<void> {}
}

async function seedSuspendedRun(
  store: InMemoryStore,
  runId: string,
  agentId: string,
  memory: { threadId: string; resourceId: string },
  status: WorkflowRunState['status'] = 'suspended',
  prompt?: string,
) {
  const messageList = new MessageList(memory);
  if (prompt) messageList.add({ role: 'user', content: prompt }, 'input');
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    resourceId: memory.resourceId,
    snapshot: {
      runId,
      status,
      value: {},
      context: {
        input: {
          __workflowKind: 'durable-agent',
          runId,
          agentId,
          messageListState: prompt ? messageList.serialize() : { memoryInfo: memory },
          requestContextEntries: { tenantId: 'tenant-1' },
          state: memory,
        },
      },
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    } as WorkflowRunState,
  });
}

// ============================================================================
// Resume API Tests
// ============================================================================

describe('Resume API', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('DurableAgent.resume()', () => {
    it('should have resume method available', () => {
      const mockModel = createTextModel('Hello');

      const baseAgent = new Agent({
        id: 'resume-test-agent',
        name: 'Resume Test Agent',
        instructions: 'Test resume',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      expect(typeof durableAgent.resume).toBe('function');
    });

    it('should accept runId and resumeData', async () => {
      const mockModel = createTextModel('Resumed!');

      const baseAgent = new Agent({
        id: 'resume-data-agent',
        name: 'Resume Data Agent',
        instructions: 'Test resume with data',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // First, prepare a run
      const { runId } = await durableAgent.prepare('Start something');

      // Resume should accept runId and data
      const result = await durableAgent.resume(runId, { approved: true });

      expect(result.runId).toBe(runId);
      expect(typeof result.cleanup).toBe('function');
      result.cleanup();
    });

    it('prepare() honors a caller-provided runId so resume(runId) can find the run', async () => {
      // Regression: prepare() previously dropped options.runId when calling
      // prepareForDurableExecution (unlike stream()), so it registered a random
      // id. That breaks rehydrating a persisted, suspended run in a fresh
      // process: resume(runId) couldn't find the registry entry prepare() built.
      const mockModel = createTextModel('Prepared!');

      const baseAgent = new Agent({
        id: 'prepare-runid-agent',
        name: 'Prepare RunId Agent',
        instructions: 'Test prepare honors runId',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestedRunId = 'fixed-run-id-aaaaaaaa';
      const prep = await durableAgent.prepare('Start something', { runId: requestedRunId });

      // prepare() must register the run under the requested id, not a random one.
      expect(prep.runId).toBe(requestedRunId);

      // ...so a follow-up resume(requestedRunId) finds the registry entry.
      const result = await durableAgent.resume(requestedRunId, { approved: true });
      expect(result.runId).toBe(requestedRunId);
      result.cleanup();
    });

    it('rehydrates a missing run registry entry before resuming', async () => {
      const mockModel = createTextModel('Resumed!');
      const store = new InMemoryStore();

      const baseAgent = new Agent({
        id: 'cold-resume-agent',
        name: 'Cold Resume Agent',
        instructions: 'Test cold resume rehydration',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      void new Mastra({ agents: { coldResumeAgent: durableAgent }, storage: store, logger: false });
      const runId = 'cold-resume-run-aaaaaaaa';
      await seedSuspendedRun(store, runId, durableAgent.id, {
        threadId: 'cold-thread',
        resourceId: 'cold-resource',
      });
      const prepareSpy = vi.spyOn(durableAgent, 'prepare');

      const result = await durableAgent.resume(runId, { approved: true });

      expect(prepareSpy).toHaveBeenCalledOnce();
      expect(prepareSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          runId,
          memory: { thread: 'cold-thread', resource: 'cold-resource' },
          requestContext: expect.anything(),
        }),
      );
      expect(prepareSpy.mock.calls[0]?.[1]?.requestContext?.get('tenantId')).toBe('tenant-1');
      expect(durableAgent.runRegistry.has(runId)).toBe(true);
      expect(result.runId).toBe(runId);
      expect(result.threadId).toBe('cold-thread');
      expect(result.resourceId).toBe('cold-resource');
      result.cleanup();
    });

    it('rejects a persisted run that is not suspended before rehydrating', async () => {
      const store = new InMemoryStore();
      const baseAgent = new Agent({
        id: 'completed-cold-resume-agent',
        name: 'Completed Cold Resume Agent',
        instructions: 'Test completed cold resume behavior',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      void new Mastra({ agents: { completedColdResumeAgent: durableAgent }, storage: store, logger: false });
      const runId = 'completed-cold-run';
      await seedSuspendedRun(
        store,
        runId,
        durableAgent.id,
        { threadId: 'completed-thread', resourceId: 'completed-resource' },
        'success',
      );
      const prepareSpy = vi.spyOn(durableAgent, 'prepare');

      await expect(durableAgent.resume(runId, { approved: true })).rejects.toMatchObject({
        id: 'AGENT_RESUME_RUN_NOT_SUSPENDED',
        details: { status: 'success' },
      });
      expect(prepareSpy).not.toHaveBeenCalled();
      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });

    it('keeps the missing-run error when no persisted snapshot exists', async () => {
      const baseAgent = new Agent({
        id: 'missing-cold-resume-agent',
        name: 'Missing Cold Resume Agent',
        instructions: 'Test missing cold resume behavior',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      void new Mastra({
        agents: { missingColdResumeAgent: durableAgent },
        storage: new InMemoryStore(),
        logger: false,
      });

      await expect(durableAgent.resume('missing-cold-run', { approved: true })).rejects.toMatchObject({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        message: 'No registry entry found for run missing-cold-run. Cannot resume.',
      });
    });

    it('does not rehydrate a persisted run owned by another agent', async () => {
      const store = new InMemoryStore();
      const baseAgent = new Agent({
        id: 'snapshot-owner-agent',
        name: 'Snapshot Owner Agent',
        instructions: 'Test snapshot ownership',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      void new Mastra({ agents: { snapshotOwnerAgent: durableAgent }, storage: store, logger: false });
      const runId = 'foreign-cold-run';
      await seedSuspendedRun(store, runId, 'different-agent', {
        threadId: 'foreign-thread',
        resourceId: 'foreign-resource',
      });

      await expect(durableAgent.resume(runId, { approved: true })).rejects.toThrow(
        `persisted run belongs to agent "different-agent", not "${durableAgent.id}"`,
      );
      expect(durableAgent.runRegistry.has(runId)).toBe(false);
    });

    it('does not re-prepare a warm run before resuming', async () => {
      const mockModel = createTextModel('Resumed!');

      const baseAgent = new Agent({
        id: 'warm-resume-agent',
        name: 'Warm Resume Agent',
        instructions: 'Test warm resume behavior',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const { runId } = await durableAgent.prepare('Start something');
      const prepareSpy = vi.spyOn(durableAgent, 'prepare');

      const result = await durableAgent.resume(runId, { approved: true });

      expect(prepareSpy).not.toHaveBeenCalled();
      expect(result.runId).toBe(runId);
      result.cleanup();
    });

    it('reports a warm resume that lost the race as AGENT_RESUME_ALREADY_CLAIMED', async () => {
      const baseAgent = new Agent({
        id: 'lost-race-resume-agent',
        name: 'Lost Race Resume Agent',
        instructions: 'Test lost resume race',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const { runId } = await durableAgent.prepare('Start something');

      // The run was suspended when this resume claimed it, but a concurrent resume ran it
      // first, so the workflow rejects with WORKFLOW_RUN_NOT_SUSPENDED.
      const workflow = durableAgent.getWorkflow();
      const createRun = workflow.createRun.bind(workflow);
      const resumeError = new MastraError({
        id: 'WORKFLOW_RUN_NOT_SUSPENDED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: 'This workflow run was not suspended',
      });
      vi.spyOn(workflow, 'createRun').mockImplementation(async (...args) => {
        const run = await createRun(...args);
        vi.spyOn(run, 'resume').mockRejectedValue(resumeError);
        return run;
      });
      const onError = vi.fn();

      const result = await durableAgent.resume(runId, { approved: true }, { onError });
      const chunks: any[] = [];
      for await (const chunk of result.fullStream) chunks.push(chunk);
      result.cleanup();

      const errorChunk = chunks.find(chunk => chunk.type === 'error');
      expect(errorChunk?.payload?.error).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
    });

    it('forwards approval execution options into the durable resume path', async () => {
      const baseAgent = new Agent({
        id: 'approval-options-agent',
        name: 'Approval Options Agent',
        instructions: 'Test approval option forwarding',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const output = { marker: 'output' };
      const resumeSpy = vi.spyOn(durableAgent, 'resume').mockResolvedValue({ output } as any);
      const memory = { thread: 'approval-thread', resource: 'approval-resource' };

      const result = await durableAgent.approveToolCall({ runId: 'approval-run', memory });

      expect(result).toBe(output);
      expect(resumeSpy).toHaveBeenCalledWith('approval-run', { approved: true }, expect.objectContaining({ memory }));
    });

    it('forwards decline execution options into the durable resume path', async () => {
      const baseAgent = new Agent({
        id: 'decline-options-agent',
        name: 'Decline Options Agent',
        instructions: 'Test decline option forwarding',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const output = { marker: 'declined-output' };
      const resumeSpy = vi.spyOn(durableAgent, 'resume').mockResolvedValue({ output } as any);
      const memory = { thread: 'decline-thread', resource: 'decline-resource' };

      const result = await durableAgent.declineToolCall({ runId: 'decline-run', memory });

      expect(result).toBe(output);
      expect(resumeSpy).toHaveBeenCalledWith('decline-run', { approved: false }, expect.objectContaining({ memory }));
    });

    it.each([
      {
        name: 'merges an approval into custom data for an approval suspension',
        approved: true,
        resumeData: { note: 'hello' },
        requiresApproval: true,
        expectedResumeData: { approved: true, note: 'hello' },
      },
      {
        name: 'keeps the decline decision authoritative when merging context into custom data',
        approved: false,
        declineContext: { reason: 'not allowed', approved: true } as { reason: string },
        resumeData: { note: 'hello' },
        requiresApproval: true,
        expectedResumeData: { approved: false, reason: 'not allowed', note: 'hello' },
      },
      {
        name: 'leaves custom data unchanged for an ordinary tool suspension',
        approved: true,
        resumeData: { note: 'hello' },
        requiresApproval: false,
        expectedResumeData: { note: 'hello' },
      },
      {
        name: 'keeps the decline decision authoritative without custom data',
        approved: false,
        declineContext: { reason: 'not allowed', approved: true } as { reason: string },
        resumeData: undefined,
        requiresApproval: true,
        expectedResumeData: { approved: false, reason: 'not allowed' },
      },
    ])('$name', async ({ approved, declineContext, resumeData, requiresApproval, expectedResumeData }) => {
      const baseAgent = new Agent({
        id: 'stored-approval-options-agent',
        name: 'Stored Approval Options Agent',
        instructions: 'Test stored approval option forwarding',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const runId = 'stored-approval-run';
      const toolCallId = 'stored-tool-call';
      const memory = { thread: 'stored-approval-thread', resource: 'stored-approval-resource' };
      const output = { marker: 'stored-approval-output' };
      const resumeSpy = vi.spyOn(durableAgent, 'resume').mockResolvedValue({ output } as any);
      const listSuspendedRunsSpy = vi.spyOn(durableAgent, 'listSuspendedRuns').mockResolvedValue({
        runs: [
          {
            runId,
            status: 'suspended',
            threadId: memory.thread,
            resourceId: memory.resource,
            suspendedAt: new Date(0),
            toolCalls: [{ toolCallId, requiresApproval }],
          },
        ],
        total: 1,
      });

      const result = await durableAgent.sendToolApproval({
        threadId: memory.thread,
        resourceId: memory.resource,
        toolCallId,
        approved,
        declineContext,
        resumeData,
        memory,
      });

      expect(listSuspendedRunsSpy).toHaveBeenCalledWith({
        threadId: memory.thread,
        resourceId: memory.resource,
      });
      expect(result).toEqual({ accepted: true, runId, toolCallId });
      expect(resumeSpy).toHaveBeenCalledWith(runId, expectedResumeData, expect.objectContaining({ memory }));
    });

    it('rejects custom data that cannot carry an approval decision', async () => {
      const baseAgent = new Agent({
        id: 'invalid-approval-data-agent',
        name: 'Invalid Approval Data Agent',
        instructions: 'Test invalid approval data rejection',
        model: createTextModel('Unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const resumeSpy = vi.spyOn(durableAgent, 'resume').mockResolvedValue({ output: undefined } as any);
      vi.spyOn(durableAgent, 'listSuspendedRuns').mockResolvedValue({
        runs: [
          {
            runId: 'invalid-approval-run',
            status: 'suspended',
            threadId: 'invalid-approval-thread',
            resourceId: 'invalid-approval-resource',
            suspendedAt: new Date(0),
            toolCalls: [{ toolCallId: 'invalid-approval-tool-call', requiresApproval: true }],
          },
        ],
        total: 1,
      });

      await expect(
        durableAgent.sendToolApproval({
          threadId: 'invalid-approval-thread',
          resourceId: 'invalid-approval-resource',
          toolCallId: 'invalid-approval-tool-call',
          approved: true,
          resumeData: 'hello',
        }),
      ).rejects.toMatchObject({ id: 'AGENT_SEND_TOOL_APPROVAL_INVALID_RESUME_DATA' });
      expect(resumeSpy).not.toHaveBeenCalled();
    });

    it('should preserve threadId and resourceId from prepare through resume', async () => {
      const mockModel = createTextModel('Done');

      const baseAgent = new Agent({
        id: 'context-resume-agent',
        name: 'Context Resume Agent',
        instructions: 'Test context preservation',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // Prepare with memory context
      const { runId, threadId, resourceId } = await durableAgent.prepare('Initial', {
        memory: {
          thread: 'thread-123',
          resource: 'resource-456',
        },
      });

      expect(threadId).toBe('thread-123');
      expect(resourceId).toBe('resource-456');

      // Resume should preserve the same context from registry
      const result = await durableAgent.resume(runId, { data: 'test' });

      expect(result.threadId).toBe('thread-123');
      expect(result.resourceId).toBe('resource-456');
      result.cleanup();
    });

    it('accepts untilIdle: true and returns a DurableAgentStreamResult', async () => {
      // No memory + no bgManager — the idle-loop wrapper short-circuits to
      // firstTurn (agent.resume) directly, so this exercises the resume-side
      // delegate without needing a real suspend/resume cycle.
      const mockModel = createTextModel('Resumed!');

      const baseAgent = new Agent({
        id: 'resume-untilidle-agent',
        name: 'Resume UntilIdle Agent',
        instructions: 'Test resume untilIdle',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const { runId } = await durableAgent.prepare('Start');

      const result = await durableAgent.resume(runId, { approved: true }, { untilIdle: true });

      expect(result.runId).toBe(runId);
      expect(typeof result.cleanup).toBe('function');
      expect(typeof result.abort).toBe('function');
      result.cleanup();
    });

    it('accepts untilIdle as { maxIdleMs } and returns a DurableAgentStreamResult', async () => {
      const mockModel = createTextModel('Resumed!');

      const baseAgent = new Agent({
        id: 'resume-untilidle-ms-agent',
        name: 'Resume UntilIdle MaxIdleMs Agent',
        instructions: 'Test resume untilIdle maxIdleMs',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      const { runId } = await durableAgent.prepare('Start');

      const result = await durableAgent.resume(runId, { approved: true }, { untilIdle: { maxIdleMs: 30_000 } });

      expect(result.runId).toBe(runId);
      expect(typeof result.cleanup).toBe('function');
      result.cleanup();
    });
  });

  describe('createDurableAgent resume()', () => {
    it('should have resume method on DurableAgent from factory', () => {
      const mockModel = createTextModel('Hello');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent });

      expect(typeof durableAgent.resume).toBe('function');
    });

    it('should return stream result from resume', async () => {
      const mockModel = createTextModel('Resumed successfully');
      const testPubsub = new EventEmitterPubSub();

      const baseAgent = new Agent({
        id: 'factory-resume-agent',
        name: 'Factory Resume Agent',
        instructions: 'Test factory resume',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({
        agent: baseAgent,
        pubsub: testPubsub,
      });

      const { runId } = await durableAgent.prepare('Hello');

      const result = await durableAgent.resume(runId, { action: 'continue' });

      expect(result.runId).toBe(runId);
      expect(result.output).toBeDefined();
      expect(typeof result.cleanup).toBe('function');
      result.cleanup();
      await testPubsub.close();
    });
  });
});

describe('Resume with CachingPubSub Event Replay', () => {
  let cache: InMemoryServerCache;
  let innerPubsub: EventEmitterPubSub;
  let cachingPubsub: CachingPubSub;

  beforeEach(() => {
    cache = new InMemoryServerCache();
    innerPubsub = new EventEmitterPubSub();
    cachingPubsub = new CachingPubSub(innerPubsub, cache);
  });

  afterEach(async () => {
    await innerPubsub.close();
  });

  it('should replay cached events on resume subscription', async () => {
    const mockModel = createSuspendingToolModel('approvalTool', { action: 'delete' });

    const approvalTool = createTool({
      id: 'approvalTool',
      description: 'A tool requiring approval',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (input, context) => {
        if (!context?.agent?.resumeData) {
          return context?.agent?.suspend?.({ reason: `Approve ${input.action}?` });
        }
        return { completed: true };
      },
    });

    const baseAgent = new Agent({
      id: 'replay-resume-agent',
      name: 'Replay Resume Agent',
      instructions: 'Test replay on resume',
      model: mockModel as LanguageModelV2,
      tools: { approvalTool },
    });

    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub: cachingPubsub,
    });

    // Start streaming - this will emit some events before suspending
    const { runId, cleanup: initialCleanup } = await durableAgent.stream('Delete the file');

    // Wait a bit for events to be cached
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify events were cached - use the correct topic format.
    // Read history before cleanup: the agent now reuses this CachingPubSub
    // instance, so cleanup clears this topic's cached history.
    const topic = `agent.stream.${runId}`;
    const cachedEvents = await cachingPubsub.getHistory(topic);
    // Events should be cached (at least the start event)
    expect(cachedEvents.length).toBeGreaterThan(0);

    // Disconnect (cleanup)
    initialCleanup();
  });

  it('resumes after cached history and streams an autonomous continuation exactly once', async () => {
    const store = new InMemoryStore();
    const approvalTool = createTool({
      id: 'approvalTool',
      description: 'A tool requiring approval',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (input, context) => {
        if (!context?.agent?.resumeData) {
          return context?.agent?.suspend?.({ reason: `Approve ${input.action}?` });
        }
        return { completed: true };
      },
    });
    const model = createSuspendingThenTextModel('approvalTool', ['resumed response', 'continuation response']);
    const baseAgent = new Agent({
      id: 'resume-until-idle-agent',
      name: 'Resume Until Idle Agent',
      instructions: 'Test resume until idle stream boundaries',
      model: model as LanguageModelV2,
      memory: new MockMemory(),
      tools: { approvalTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub });
    const mastra = new Mastra({
      agents: { resumeUntilIdleAgent: durableAgent },
      storage: store,
      logger: false,
      backgroundTasks: { enabled: true },
    });
    const runId = 'resume-until-idle-run';
    const threadId = 'resume-until-idle-thread';
    const resourceId = 'resume-until-idle-resource';
    const initial = await durableAgent.stream('Start', {
      runId,
      memory: { thread: threadId, resource: resourceId },
      closeOnSuspend: true,
    });
    const retainedChunks = await drain(initial.fullStream);
    expect(retainedChunks.some(chunk => chunk.type === 'tool-call')).toBe(true);

    const streamSpy = vi.spyOn(durableAgent, 'stream');
    const result = await durableAgent.resume(runId, { approved: true }, { untilIdle: true });
    const chunksPromise = drain(result.fullStream);
    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = async (type: string) => {
      await (bgManager as any).publishLifecycleEvent(type, {
        id: 'resume-task',
        toolName: 'dummy',
        toolCallId: 'resume-task',
        runId: 'background-run',
        agentId: durableAgent.id,
        threadId,
        resourceId,
        status: type.split('.')[1],
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: {},
      });
    };

    await publishEvent('task.running');
    await new Promise(resolve => setTimeout(resolve, 50));
    await publishEvent('task.completed');

    const chunks = await chunksPromise;
    const texts = chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text);
    expect(texts).toEqual(['resumed response', 'continuation response']);
    expect(chunks.some(chunk => chunk.type === 'tool-call')).toBe(false);
    expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(2);
    expect(result.runId).toBe(runId);
    expect(streamSpy).toHaveBeenCalledOnce();
    expect(streamSpy.mock.calls[0]?.[1]).not.toHaveProperty('runId');

    result.cleanup();
    await mastra.backgroundTaskManager?.shutdown();
  });

  it('should deliver resumed output without replaying retained events when cached history is unavailable', async () => {
    const storage = new InMemoryStore();
    const memoryStorage = new InMemoryStore();
    const transport = new RetainingPubSub();
    const memory = { thread: 'cache-miss-thread', resource: 'cache-miss-resource' };

    const buildAgent = (seenText: string[]) => {
      const tool = createTool({
        id: 'approvalTool',
        description: 'Wait for approval',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({ reason: z.string() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async (input, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend?.({ reason: `Approve ${input.action}?` });
          }
          return { completed: true };
        },
      });
      const model = new MockLanguageModelV2({
        doStream: async ({ prompt }) =>
          JSON.stringify(prompt).includes('"type":"tool-result"')
            ? createTextModel('Resumed').doStream({ prompt } as any)
            : createSuspendingToolModel('approvalTool', { action: 'delete' }).doStream({ prompt } as any),
      });
      const agent = new Agent({
        id: 'cache-miss-resume-agent',
        name: 'Cache Miss Resume Agent',
        instructions: 'Use the tool, then answer.',
        model: model as LanguageModelV2,
        memory: new MockMemory({ storage: memoryStorage }),
        tools: { approvalTool: tool },
        outputProcessors: [
          {
            id: 'record-resumed-text',
            processOutputStream: async ({ part }: any) => {
              if (part.type === 'text-delta') seenText.push(part.payload?.text ?? part.delta ?? '');
              return part;
            },
          },
        ],
      });
      const pubsub = new CachingPubSub(transport, new InMemoryServerCache());
      const durableAgent = createDurableAgent({ agent, pubsub });
      new Mastra({ agents: { cacheMissResumeAgent: durableAgent }, storage, logger: false });
      return durableAgent;
    };

    const firstProcessText: string[] = [];
    const firstProcess = buildAgent(firstProcessText);
    const started = await firstProcess.stream('Delete the file', { memory, closeOnSuspend: true });
    for await (const _chunk of started.fullStream) void _chunk;

    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({
        runId: started.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
    });

    await transport.publish(AGENT_STREAM_TOPIC(started.runId), {
      type: AgentStreamEventTypes.CHUNK,
      runId: started.runId,
      data: { type: 'text-delta', payload: { id: 'stale', text: 'STALE' } },
    });

    globalRunRegistry.clear();
    const resumedText: string[] = [];
    const secondProcess = buildAgent(resumedText);
    const resumed = await secondProcess.resumeStream(
      { approved: true },
      { runId: started.runId, toolCallId: 'call-1', memory },
    );
    for await (const _chunk of resumed.fullStream) void _chunk;

    expect(resumedText).toContain('Resumed');
    expect(resumedText).not.toContain('STALE');
  });

  it('closes a closeOnSuspend stream only after the suspended snapshot is persisted (issue #26454)', async () => {
    const storage = new InMemoryStore();
    const memory = { thread: 'persist-order-thread', resource: 'persist-order-resource' };
    const workflows = (await storage.getStore('workflows'))!;
    // Delay the suspended snapshot write so the SUSPENDED event (published
    // from inside the tool-call step) reliably arrives before persistence.
    const originalPersist = workflows.persistWorkflowSnapshot.bind(workflows);
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if ((args.snapshot as WorkflowRunState | undefined)?.status === 'suspended') {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return originalPersist(args);
    });
    // Storage v2 stores a status in the run's header.
    for (const method of [
      'appendWorkflowRunEntries',
      'writeWorkflowRunCheckpoint',
      'updateWorkflowRunHeader',
    ] as const) {
      const write = (workflows[method] as (args: any) => Promise<unknown>).bind(workflows);
      (workflows[method] as (args: any) => Promise<unknown>) = async args => {
        const status = method === 'updateWorkflowRunHeader' ? args.opts?.status : args.header?.status;
        if (status === 'suspended') await new Promise(resolve => setTimeout(resolve, 300));
        return write(args);
      };
    }

    const tool = createTool({
      id: 'approvalTool',
      description: 'Wait for approval',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (input, context) => {
        if (!context?.agent?.resumeData) {
          return context?.agent?.suspend?.({ reason: `Approve ${input.action}?` });
        }
        return { completed: true };
      },
    });
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) =>
        JSON.stringify(prompt).includes('"type":"tool-result"')
          ? createTextModel('Resumed').doStream({ prompt } as any)
          : createSuspendingToolModel('approvalTool', { action: 'delete' }).doStream({ prompt } as any),
    });
    const agent = new Agent({
      id: 'persist-order-agent',
      name: 'Persist Order Agent',
      instructions: 'Use the tool, then answer.',
      model: model as LanguageModelV2,
      memory: new MockMemory({ storage: new InMemoryStore() }),
      tools: { approvalTool: tool },
    });
    const durableAgent = createDurableAgent({
      agent,
      pubsub: new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache()),
    });
    new Mastra({ agents: { persistOrderAgent: durableAgent }, storage, logger: false });

    const onSuspended = vi.fn();
    const started = await durableAgent.stream('Delete the file', { memory, closeOnSuspend: true, onSuspended });
    for await (const _chunk of started.fullStream) void _chunk;

    const persisted = await workflows.getWorkflowRunById({
      runId: started.runId,
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
    expect(snapshot?.status).toBe('suspended');
    expect(onSuspended).toHaveBeenCalledOnce();

    // Cold resume immediately after the stream closed.
    started.cleanup();
    globalRunRegistry.clear();
    const resumed = await durableAgent.resumeStream(
      { approved: true },
      { runId: started.runId, toolCallId: 'call-1', memory },
    );
    const text: string[] = [];
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'text-delta') text.push(chunk.payload.text);
    }
    expect(text.join('')).toContain('Resumed');
  });

  it('should deduplicate events during resume replay', async () => {
    const receivedEvents: Event[] = [];
    const mockModel = createTextModel('Response');

    const baseAgent = new Agent({
      id: 'dedup-agent',
      name: 'Dedup Agent',
      instructions: 'Test deduplication',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub: cachingPubsub,
    });

    // Start and get runId
    const { runId, cleanup } = await durableAgent.stream('Hello');

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 100));

    // Subscribe with replay - should get events without duplicates.
    // Replay before cleanup: the agent now reuses this CachingPubSub instance,
    // so cleanup clears this topic's cached history.
    const topic = `agent.stream.${runId}`;
    await cachingPubsub.subscribeWithReplay(topic, event => {
      receivedEvents.push(event);
    });

    cleanup();

    // Each event ID should be unique
    const eventIds = receivedEvents.map(e => e.id);
    const uniqueIds = new Set(eventIds);
    expect(uniqueIds.size).toBe(eventIds.length);
  });
});

describe('Resume with Tool Approval', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should accept onSuspended option in resume', async () => {
    const mockModel = createTextModel('Done');
    const onSuspended = vi.fn();

    const baseAgent = new Agent({
      id: 'suspended-callback-agent',
      name: 'Suspended Callback Agent',
      instructions: 'Test suspended callback',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { runId } = await durableAgent.prepare('Start');

    const result = await durableAgent.resume(
      runId,
      { approved: true },
      {
        onSuspended,
      },
    );

    expect(result.runId).toBe(runId);
    result.cleanup();
  });

  it('should support onFinish callback in resume options', async () => {
    const mockModel = createTextModel('Completed');
    const onFinish = vi.fn();

    const baseAgent = new Agent({
      id: 'finish-callback-agent',
      name: 'Finish Callback Agent',
      instructions: 'Test finish callback',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { runId } = await durableAgent.prepare('Start');

    const result = await durableAgent.resume(
      runId,
      { data: 'resume-data' },
      {
        onFinish,
      },
    );

    expect(result.runId).toBe(runId);
    result.cleanup();
  });

  it('should support onError callback in resume options', async () => {
    const mockModel = createTextModel('Error test');
    const onError = vi.fn();

    const baseAgent = new Agent({
      id: 'error-callback-agent',
      name: 'Error Callback Agent',
      instructions: 'Test error callback',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { runId } = await durableAgent.prepare('Start');

    const result = await durableAgent.resume(
      runId,
      {},
      {
        onError,
      },
    );

    expect(result.runId).toBe(runId);
    result.cleanup();
  });
});

describe('Resume State Preservation', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should maintain run registry across prepare and resume', async () => {
    const mockModel = createSuspendingToolModel('statefulTool', { key: 'value' });

    const statefulTool = createTool({
      id: 'statefulTool',
      description: 'A stateful tool',
      inputSchema: z.object({ key: z.string() }),
      execute: async () => ({ stored: true }),
    });

    const baseAgent = new Agent({
      id: 'registry-agent',
      name: 'Registry Agent',
      instructions: 'Test registry',
      model: mockModel as LanguageModelV2,
      tools: { statefulTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Prepare creates registry entry
    const { runId } = await durableAgent.prepare('Store something');

    // Tools should be in registry
    const toolsBefore = durableAgent.runRegistry.getTools(runId);
    expect(toolsBefore.statefulTool).toBeDefined();

    // Resume should still have access to registry
    const { cleanup } = await durableAgent.resume(runId, { continue: true });

    const toolsAfter = durableAgent.runRegistry.getTools(runId);
    expect(toolsAfter.statefulTool).toBeDefined();

    cleanup();
  });

  it('should clean up registry on cleanup', async () => {
    const mockModel = createTextModel('Cleanup test');

    const baseAgent = new Agent({
      id: 'cleanup-registry-agent',
      name: 'Cleanup Registry Agent',
      instructions: 'Test cleanup',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { runId, cleanup } = await durableAgent.stream('Test message');

    // Run should be registered initially
    expect(durableAgent.runRegistry.has(runId)).toBe(true);

    // Wait for stream to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup should remove from registry
    cleanup();
    await vi.waitFor(() => expect(durableAgent.runRegistry.has(runId)).toBe(false));
  });
});

describe('Observe API', () => {
  let cache: InMemoryServerCache;
  let innerPubsub: EventEmitterPubSub;
  let cachingPubsub: CachingPubSub;

  beforeEach(() => {
    cache = new InMemoryServerCache();
    innerPubsub = new EventEmitterPubSub();
    cachingPubsub = new CachingPubSub(innerPubsub, cache);
  });

  afterEach(async () => {
    await innerPubsub.close();
  });

  it('should have observe method available', () => {
    const mockModel = createTextModel('Hello');

    const baseAgent = new Agent({
      id: 'observe-test-agent',
      name: 'Observe Test Agent',
      instructions: 'Test observe',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub: cachingPubsub,
    });

    expect(typeof durableAgent.observe).toBe('function');
  });

  it.each([DurableAgent, EventedAgent])(
    'rejects a foreign live observer before exposing run state (%#)',
    async createAgent => {
      const store = new InMemoryStore();
      const processOutputStream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
      const baseAgent = new Agent({
        id: 'wrapped-observe-agent',
        name: 'Live Observe Agent',
        instructions: 'Test live observer ownership',
        model: createTextModel('unused') as LanguageModelV2,
      });
      const producer = new createAgent({ id: 'producer-public-id', agent: baseAgent, pubsub: cachingPubsub });
      const observer = new createAgent({ id: 'foreign-public-id', agent: baseAgent, pubsub: cachingPubsub });
      const mastra = new Mastra({ agents: { producer }, storage: store, logger: false });
      observer.__setMastra(mastra);
      const requestContext = new RequestContext([['tenantId', 'private-tenant']]);
      const { runId } = await producer.prepare('Private producer prompt', {
        requestContext,
        outputProcessors: [{ id: 'private-processor', processOutputStream }],
        returnScorerData: true,
      });
      const entry = globalRunRegistry.get(runId)!;
      entry.messageList!.add({ role: 'assistant', content: 'Private producer answer' }, 'response');
      const resolveProcessors = vi.spyOn(baseAgent, 'listOutputProcessors');
      const subscribe = vi.spyOn(producer.pubsub, 'subscribeWithReplay');
      const attachment = observer.observe(runId);
      let unexpectedResult: Awaited<typeof attachment> | undefined;

      try {
        await expect(attachment.then(result => (unexpectedResult = result))).rejects.toMatchObject({
          id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
          details: { runId, ownerAgentId: producer.id },
        });
        expect(unexpectedResult).toBeUndefined();
        expect(resolveProcessors).not.toHaveBeenCalled();
        expect(processOutputStream).not.toHaveBeenCalled();
        expect(subscribe).not.toHaveBeenCalled();
        expect(observer.runRegistry.has(runId)).toBe(false);
        expect(globalRunRegistry.get(runId)).toBe(entry);
        expect(entry.requestContext).toBe(requestContext);

        const ownerResult = await producer.observe(runId);
        try {
          expect(subscribe).toHaveBeenCalledWith(AGENT_STREAM_TOPIC(runId), expect.any(Function));
          const fullOutput = ownerResult.output.getFullOutput();
          await emitFinishEvent(producer.pubsub, runId, {
            output: {
              text: 'Private producer answer',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              steps: [],
            },
            stepResult: { reason: 'stop', warnings: [], isContinued: false },
          });
          const output = await fullOutput;
          expect(JSON.stringify(output.scoringData?.input.inputMessages)).toContain('Private producer prompt');
          expect(JSON.stringify(output.scoringData?.output)).toContain('Private producer answer');
        } finally {
          ownerResult.detach();
        }
      } finally {
        unexpectedResult?.detach();
        producer.runRegistry.cleanup(runId);
        globalRunRegistry.delete(runId);
        resolveProcessors.mockRestore();
        subscribe.mockRestore();
      }
    },
  );

  describe.each([DurableAgent, EventedAgent])('live observer wrapper %#', createAgent => {
    it.each(['default', 'override', 'legacy'] as const)(
      'preserves live call-time state with %s identity in the same Mastra instance',
      async identity => {
        const store = new InMemoryStore();
        const processOutputStream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
        const processor: Processor = { id: 'call-time-observer-processor', processOutputStream };
        const baseAgent = new Agent({
          id: 'shared-observe-agent',
          name: 'Shared Observe Agent',
          instructions: 'Test shared observer state',
          model: createTextModel('unused') as LanguageModelV2,
        });
        const id = identity === 'override' ? 'shared-public-observe-agent' : undefined;
        const producer = new createAgent({ id, agent: baseAgent, pubsub: cachingPubsub });
        const observer = new createAgent({ id, agent: baseAgent, pubsub: cachingPubsub });
        const mastra = new Mastra({ agents: { producer }, storage: store, logger: false });
        observer.__setMastra(mastra);
        const requestContext = new RequestContext([['tenantId', 'live-tenant']]);
        const { runId, workflowInput } = await producer.prepare('Live observer prompt', {
          requestContext,
          outputProcessors: [processor],
          returnScorerData: true,
        });
        const entry = globalRunRegistry.get(runId)!;
        expect(entry.agentId).toBe(producer.id);
        expect(producer.runRegistry.get(runId)?.agentId).toBe(producer.id);
        if (identity === 'legacy') delete entry.agentId;
        entry.messageList!.add({ role: 'assistant', content: 'Live observer answer' }, 'response');
        expect(workflowInput.agentId).toBe(producer.id);
        const resolveProcessors = vi.spyOn(baseAgent, 'listOutputProcessors');
        expect(observer.runRegistry.has(runId)).toBe(false);
        const result = await observer.observe(runId);
        const fullOutput = result.output.getFullOutput();

        try {
          await emitChunkEvent(producer.pubsub, runId, {
            type: 'text-delta',
            runId,
            from: 'AGENT',
            payload: { id: 'observed-text', text: 'Live observer answer' },
          });
          await emitFinishEvent(producer.pubsub, runId, {
            output: {
              text: 'Live observer answer',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              steps: [],
            },
            stepResult: { reason: 'stop', warnings: [], isContinued: false },
          });
          const output = await fullOutput;

          expect(resolveProcessors).not.toHaveBeenCalled();
          expect(processOutputStream).toHaveBeenCalledWith(expect.objectContaining({ requestContext }));
          expect(JSON.stringify(output.scoringData?.input.inputMessages)).toContain('Live observer prompt');
          expect(JSON.stringify(output.scoringData?.output)).toContain('Live observer answer');
        } finally {
          result.detach();
          producer.runRegistry.cleanup(runId);
          globalRunRegistry.delete(runId);
          resolveProcessors.mockRestore();
        }
      },
    );
  });

  describe.each([DurableAgent, EventedAgent])('prepared observer wrapper %#', AgentClass => {
    it('retains effective ownership when observing a prepared run without live state', async () => {
      const store = new InMemoryStore();
      const baseAgent = new Agent({
        id: 'wrapped-prepared-agent',
        name: 'Wrapped Prepared Agent',
        instructions: 'Test prepared ownership',
        model: createTextModel('unused') as LanguageModelV2,
      });
      const producer = new AgentClass({
        id: 'public-prepared-agent',
        name: 'Public Prepared Agent',
        agent: baseAgent,
        pubsub: cachingPubsub,
      });
      new Mastra({ agents: { producer }, storage: store, logger: false });
      const { runId, workflowInput } = await producer.prepare('Private prepared prompt');
      const workflows = (await store.getStore('workflows'))!;
      await workflows.persistWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
        snapshot: {
          runId,
          status: 'suspended',
          value: {},
          context: { input: workflowInput },
          activePaths: [],
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          serializedStepGraph: [],
          waitingPaths: {},
          timestamp: Date.now(),
        } as WorkflowRunState,
      });
      producer.runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);

      const owner = new AgentClass({ id: producer.id, agent: baseAgent, pubsub: cachingPubsub });
      const foreign = new AgentClass({ agent: baseAgent, pubsub: cachingPubsub });
      new Mastra({ agents: { owner, foreign }, storage: store, logger: false });
      let result: Awaited<ReturnType<typeof owner.observe>> | undefined;
      try {
        await expect(foreign.observe(runId)).rejects.toMatchObject({
          id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
          details: { runId, ownerAgentId: producer.id },
        });
        result = await owner.observe(runId);
        const fullOutput = result.output.getFullOutput();
        await emitFinishEvent(owner.pubsub, runId, {
          output: { text: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, steps: [] },
          stepResult: { reason: 'stop', warnings: [], isContinued: false },
        });
        expect(JSON.stringify((await fullOutput).messages)).toContain('Private prepared prompt');
        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
        expect(snapshot?.context?.input).toMatchObject({ agentId: producer.id, agentName: producer.name });
      } finally {
        result?.detach();
        owner.runRegistry.cleanup(runId);
        foreign.runRegistry.cleanup(runId);
        globalRunRegistry.delete(runId);
      }
    });
  });

  describe.each(['placeholder', 'rebuilt', 'absent'] as const)('with a %s worker registry entry', entryKind => {
    it('restores persisted context, processors, and transcript without live state', async () => {
      const store = new InMemoryStore();
      const baseAgent = new Agent({
        id: 'partial-observe-agent',
        name: 'Partial Observe Agent',
        instructions: 'Test partial worker state',
        model: createTextModel('unused') as LanguageModelV2,
        outputProcessors: [{ id: 'persisted-observer-processor', processOutputStream: ({ part }) => part }],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub });
      new Mastra({ agents: { durableAgent }, storage: store, logger: false });
      const runId = `observe-${entryKind}-worker-run`;
      await seedSuspendedRun(
        store,
        runId,
        durableAgent.id,
        { threadId: 'persisted-thread', resourceId: 'persisted-resource' },
        'suspended',
        'Persisted observer prompt',
      );
      if (entryKind !== 'absent') {
        globalRunRegistry.set(runId, {
          isPlaceholder: entryKind === 'placeholder',
          ...(entryKind === 'rebuilt' ? { tools: {}, outputProcessors: [], processorStates: new Map() } : {}),
        } as Parameters<typeof globalRunRegistry.set>[1]);
      }
      const resolveProcessors = vi.spyOn(baseAgent, 'listOutputProcessors');
      let result: Awaited<ReturnType<typeof durableAgent.observe>> | undefined;
      try {
        result = await durableAgent.observe(runId);
        const fullOutput = result.output.getFullOutput();
        await emitFinishEvent(cachingPubsub, runId, {
          output: { text: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, steps: [] },
          stepResult: { reason: 'stop', warnings: [], isContinued: false },
        });
        const output = await fullOutput;
        expect(resolveProcessors).toHaveBeenCalledOnce();
        const context = resolveProcessors.mock.calls[0]![0];
        expect(context?.get('tenantId')).toBe('tenant-1');
        expect(JSON.stringify(output.messages)).toContain('Persisted observer prompt');
      } finally {
        result?.detach();
        globalRunRegistry.delete(runId);
        resolveProcessors.mockRestore();
      }
    });

    it('rejects a foreign persisted run without live state', async () => {
      const store = new InMemoryStore();
      const baseAgent = new Agent({
        id: 'partial-owner-observe-agent',
        name: 'Partial Owner Observe Agent',
        instructions: 'Test partial worker ownership',
        model: createTextModel('unused') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub });
      new Mastra({ agents: { durableAgent }, storage: store, logger: false });
      const runId = `observe-${entryKind}-foreign-worker-run`;
      await seedSuspendedRun(store, runId, 'foreign-agent', {
        threadId: 'foreign-thread',
        resourceId: 'foreign-resource',
      });
      if (entryKind !== 'absent') {
        globalRunRegistry.set(runId, {
          isPlaceholder: entryKind === 'placeholder',
          ...(entryKind === 'rebuilt' ? { tools: {}, outputProcessors: [], processorStates: new Map() } : {}),
        } as Parameters<typeof globalRunRegistry.set>[1]);
      }
      let result: Awaited<ReturnType<typeof durableAgent.observe>> | undefined;
      try {
        await expect(
          durableAgent.observe(runId).then(observed => {
            result = observed;
            return observed;
          }),
        ).rejects.toMatchObject({
          id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
          details: { runId, ownerAgentId: 'foreign-agent' },
        });
      } finally {
        result?.detach();
        globalRunRegistry.delete(runId);
      }
    });
  });

  it('continues observing when configured processor resolution fails', async () => {
    const store = new InMemoryStore();
    const baseAgent = new Agent({
      id: 'observe-failed-processors-agent',
      name: 'Observe Failed Processors Agent',
      instructions: 'Test observer processor fallback',
      model: createTextModel('unused') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub });
    const mastra = new Mastra({ agents: { durableAgent }, storage: store, logger: false });
    const runId = 'observe-failed-processors-run';
    await seedSuspendedRun(store, runId, durableAgent.id, {
      threadId: 'fallback-thread',
      resourceId: 'fallback-resource',
    });
    const resolveProcessors = vi
      .spyOn(baseAgent, 'listOutputProcessors')
      .mockRejectedValue(new Error('resolver failed'));
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const result = await durableAgent.observe(runId);
    const fullOutput = result.output.getFullOutput();

    try {
      await emitChunkEvent(cachingPubsub, runId, {
        type: 'text-delta',
        runId,
        from: 'AGENT',
        payload: { id: 'fallback-text', text: 'Fallback answer' },
      });
      await emitFinishEvent(cachingPubsub, runId, {
        output: { text: 'Fallback answer', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
        stepResult: { reason: 'stop', warnings: [], isContinued: false },
      });

      expect((await fullOutput).text).toBe('Fallback answer');
      expect(resolveProcessors).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(
        `[DurableAgent] observe(${runId}) processor resolution failed: Error: resolver failed`,
      );
    } finally {
      result.detach();
      resolveProcessors.mockRestore();
      warn.mockRestore();
    }
  });

  it('rejects a persisted run owned by another agent', async () => {
    const runId = 'observe-foreign-agent-run';
    const store = new InMemoryStore();
    const baseAgent = new Agent({
      id: 'observing-agent',
      name: 'Observing Agent',
      instructions: 'Test observer ownership',
      model: createTextModel('unused') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub });
    new Mastra({ agents: { observingAgent: durableAgent }, storage: store, logger: false });
    await seedSuspendedRun(
      store,
      runId,
      'foreign-agent',
      { threadId: 'observe-foreign-thread', resourceId: 'observe-foreign-resource' },
      'running',
    );

    await expect(durableAgent.observe(runId)).rejects.toMatchObject({
      id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
      details: { runId, ownerAgentId: 'foreign-agent' },
    });
  });

  it('does not insert a global registry entry when observing an unknown run', async () => {
    const runId = 'observe-missing-global-entry';
    const baseAgent = new Agent({
      id: 'observe-missing-entry-agent',
      name: 'Observe Missing Entry Agent',
      instructions: 'Test missing observer state',
      model: createTextModel('unused') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub });

    expect(globalRunRegistry.has(runId)).toBe(false);
    const observed = await durableAgent.observe(runId);
    expect(globalRunRegistry.has(runId)).toBe(false);
    observed.detach();
  });

  it('should return stream result from observe', async () => {
    const mockModel = createTextModel('Hello from observe');

    const baseAgent = new Agent({
      id: 'observe-result-agent',
      name: 'Observe Result Agent',
      instructions: 'Test observe result',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub: cachingPubsub,
    });

    // Start a stream first
    const { runId, cleanup: streamCleanup } = await durableAgent.stream('Start stream');

    // Wait for events to be cached
    await new Promise(resolve => setTimeout(resolve, 100));
    streamCleanup();

    // Observe should return a stream result
    const result = await durableAgent.observe(runId);

    expect(result.runId).toBe(runId);
    expect(result.output).toBeDefined();
    expect(typeof result.cleanup).toBe('function');
    result.cleanup();
  });

  it('should support offset for efficient resume', async () => {
    const mockModel = createTextModel('Indexed stream');

    const baseAgent = new Agent({
      id: 'observe-index-agent',
      name: 'Observe Index Agent',
      instructions: 'Test indexed observe',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub: cachingPubsub,
    });

    // Start a stream
    const { runId, cleanup: streamCleanup } = await durableAgent.stream('Generate events');

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 100));
    streamCleanup();

    // Observe from a specific index (should not throw)
    const result = await durableAgent.observe(runId, { offset: 0 });

    expect(result.runId).toBe(runId);
    result.cleanup();
  });

  it('should accept callbacks in observe options', async () => {
    const mockModel = createTextModel('Callback test');
    const onChunk = vi.fn();
    const onFinish = vi.fn();

    const baseAgent = new Agent({
      id: 'observe-callbacks-agent',
      name: 'Observe Callbacks Agent',
      instructions: 'Test observe callbacks',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub: cachingPubsub,
    });

    const { runId, cleanup: streamCleanup } = await durableAgent.stream('Hello');
    await new Promise(resolve => setTimeout(resolve, 100));
    streamCleanup();

    const result = await durableAgent.observe(runId, {
      onChunk,
      onFinish,
    });

    // Wait for replay
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(result.runId).toBe(runId);
    result.cleanup();
  });
});

// ============================================================================
// Per-call tool injection (toolsets / clientTools) — in-process resume
// ============================================================================

describe('per-call tool injection survives in-process resume', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('preserves per-call clientTools on the run registry after prepare', async () => {
    const mockModel = createTextModel('ok');

    const baseAgent = new Agent({
      id: 'clienttools-resume-agent',
      name: 'ClientTools Resume Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const perCallClientTool = createTool({
      id: 'perCallClientTool',
      description: 'Injected per-call only',
      inputSchema: z.object({ q: z.string() }),
      execute: async ({ context }) => `client:${context.q}`,
    });

    const { runId } = await durableAgent.prepare('Start', {
      clientTools: { perCallClientTool },
    });

    const tools = durableAgent.runRegistry.getTools(runId);
    expect(tools).toBeDefined();
    expect(tools?.perCallClientTool).toBeDefined();
  });

  it('preserves per-call toolsets on the run registry after prepare', async () => {
    const mockModel = createTextModel('ok');

    const baseAgent = new Agent({
      id: 'toolsets-resume-agent',
      name: 'Toolsets Resume Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const perCallToolsetTool = createTool({
      id: 'perCallToolsetTool',
      description: 'Injected via toolset only',
      inputSchema: z.object({ q: z.string() }),
      execute: async ({ context }) => `toolset:${context.q}`,
    });

    const { runId } = await durableAgent.prepare('Start', {
      toolsets: {
        perCallToolset: { perCallToolsetTool },
      },
    });

    const tools = durableAgent.runRegistry.getTools(runId);
    expect(tools).toBeDefined();
    expect(tools?.perCallToolsetTool).toBeDefined();
  });
});

// #28229: invalid data must not consume the suspension before the caller can correct it.
// Both engines. The `durable-other-storage-version` Vitest project runs this suite again with runs
// stored in the other workflow storage version.
describe.each([DurableAgent, EventedAgent])('resume schema preflight (%#)', AgentClass => {
  it.each(
    ['warm', 'cold'].flatMap(registry =>
      (['resumeStream', 'resumeGenerate', 'resume'] as const).flatMap(method =>
        // `toolset-retained`: the toolset is passed to the first call only; a warm run keeps it.
        // `sanitized`: formatTools() exposes the tool as `ask-confirm_`, the name the call records.
        ['assigned', 'toolset', 'sanitized', ...(registry === 'warm' ? ['toolset-retained'] : [])].map(source => ({
          registry,
          method,
          source,
        })),
      ),
    ),
  )(
    'allows correcting invalid data via $method with a $registry registry and $source tool',
    async ({ registry, method, source }) => {
      const resumedValues: unknown[] = [];
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }).transform(data => ({ ...data, validated: true })),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          resumedValues.push(context.agent.resumeData);
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const toolName = source === 'sanitized' ? 'ask-confirm_' : 'ask';
      const agent = new Agent({
        id: 'resume-schema-agent',
        name: 'Resume Schema Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel(toolName, ['Confirmed']),
        tools: source === 'assigned' ? { ask } : source === 'sanitized' ? { 'ask-confirm?': ask } : {},
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const toolOptions = source.startsWith('toolset') ? { toolsets: { extra: { ask } } } : {};
        const initial = await durable.stream('Confirm', { closeOnSuspend: true, ...toolOptions });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = {
          ...(source === 'toolset' ? toolOptions : {}),
          runId: initial.runId,
          ...(registry === 'warm' ? { toolCallId: 'call-1' } : {}),
        };
        const resume = async (data: unknown) => {
          if (method === 'resumeGenerate') return durable.resumeGenerate(data, options);
          const output =
            method === 'resume'
              ? (await durable.resume(initial.runId, data, options)).output
              : await durable.resumeStream(data, options);
          return output.getFullOutput();
        };
        await expect(resume({ confirmed: 'yes' })).rejects.toMatchObject({
          id: 'AGENT_RESUME_INVALID_DATA',
        });
        expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);
        expect(resumedValues).toEqual([]);
        const resumed = await resume({ confirmed: true });
        expect(resumed.error).toBeUndefined();
        expect(resumed.text).toBe('Confirmed');
        // The preflight hands the caller's data on unchanged: the tool applies its own resumeSchema
        // (transform included) when it executes, as it does without the preflight.
        expect(resumedValues).toEqual([{ confirmed: true }]);
        expect(resumed.toolResults.map(chunk => chunk.payload.result)).toContainEqual({ confirmed: true });
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a toolCallId that names no suspended call skipped the preflight, but the workflow
  // resumes the only suspended step when the label is unknown, so the invalid data consumed it.
  it.each(['warm', 'cold'] as const)(
    'validates data for the only suspended call when toolCallId names no call ($0 registry)',
    async registry => {
      const resumedValues: unknown[] = [];
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          resumedValues.push(context.agent.resumeData);
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-schema-agent',
        name: 'Resume Schema Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: { ask },
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = { runId: initial.runId, toolCallId: 'unknown-call' };

        await expect(durable.resumeGenerate({ confirmed: 'yes' }, options)).rejects.toMatchObject({
          id: 'AGENT_RESUME_INVALID_DATA',
        });
        expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);
        expect(resumedValues).toEqual([]);

        const resumed = await durable.resumeGenerate(
          { confirmed: true },
          { runId: initial.runId, toolCallId: 'call-1' },
        );
        expect(resumed.error).toBeUndefined();
        expect(resumedValues).toEqual([{ confirmed: true }]);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: the rejected attempt wrote its request context onto the run registry entry (warm)
  // or left the entry prepare() rebuilt from it registered (cold), and the retry seeded from it.
  it.each(['warm', 'cold'].flatMap(registry => [false, true].map(untilIdle => ({ registry, untilIdle }))))(
    'a corrected retry runs the tool with the original request context, not the rejected one ($registry registry, untilIdle $untilIdle)',
    async ({ registry, untilIdle }) => {
      const seenTenants: unknown[] = [];
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          seenTenants.push(context.requestContext?.get('tenant'));
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-context-agent',
        name: 'Resume Context Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: { ask },
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Confirm', {
          closeOnSuspend: true,
          requestContext: new RequestContext([['tenant', 'acme']]),
        });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = { runId: initial.runId, ...(untilIdle ? { untilIdle: true } : {}) };

        await expect(
          durable.resume(
            initial.runId,
            { confirmed: 'yes' },
            {
              ...options,
              requestContext: new RequestContext([['tenant', 'rejected-caller']]),
            },
          ),
        ).rejects.toMatchObject({ id: 'AGENT_RESUME_INVALID_DATA' });

        // The retry's own request sets no tenant, so the tenant must come from the suspended run.
        const retry = await durable.resume(
          initial.runId,
          { confirmed: true },
          {
            ...options,
            requestContext: new RequestContext([['requestId', 'retry']]),
          },
        );
        const resumed = await retry.output.getFullOutput();
        expect(resumed.error).toBeUndefined();
        expect(resumed.text).toBe('Confirmed');
        expect(seenTenants).toEqual(['acme']);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a rejected cold resume removed the run's rebuilt registry entry after a concurrent valid
  // resume had adopted it, which also cleared that resume's total deadline timer.
  it('a rejected resume that finishes while a valid one runs leaves the valid run its timeout', async () => {
    let releaseRejected!: () => void;
    const rejectedMayFinish = new Promise<void>(resolve => {
      releaseRejected = resolve;
    });
    let markRejectedWaiting!: () => void;
    const rejectedWaiting = new Promise<void>(resolve => {
      markRejectedWaiting = resolve;
    });
    let markToolStarted!: () => void;
    const toolStarted = new Promise<void>(resolve => {
      markToolStarted = resolve;
    });
    const abortedByDeadline: boolean[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        markToolStarted();
        const signal = context.abortSignal;
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 1500);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        abortedByDeadline.push(signal?.aborted ?? false);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-deadline-agent',
      name: 'Resume Deadline Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Confirmed']),
      tools: async ({ requestContext }) => {
        if (requestContext.get('tenant') === 'rejected-caller') {
          markRejectedWaiting();
          await rejectedMayFinish;
        }
        return { ask };
      },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        requestContext: new RequestContext([['tenant', 'acme']]),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      const rejected = durable.resume(
        initial.runId,
        { confirmed: 'yes' },
        { runId: initial.runId, requestContext: new RequestContext([['tenant', 'rejected-caller']]) },
      );
      // The rejected resume has rebuilt the run and is still resolving its tools.
      await rejectedWaiting;
      const valid = durable.resume(
        initial.runId,
        { confirmed: true },
        {
          runId: initial.runId,
          requestContext: new RequestContext([['requestId', 'valid']]),
          modelSettings: { timeout: { totalMs: 300 } },
        },
      );
      // Let the rejected resume finish once the valid one is running, or shortly after if it is held back.
      await Promise.race([toolStarted, new Promise(resolve => setTimeout(resolve, 100))]);
      releaseRejected();

      await expect(rejected).rejects.toMatchObject({ id: 'AGENT_RESUME_INVALID_DATA' });
      // The valid resume still stops at its own deadline.
      await expect((await valid).output.getFullOutput()).rejects.toThrow('modelSettings.timeout.totalMs');
      await vi.waitFor(() => expect(abortedByDeadline).toEqual([true]));
    } finally {
      releaseRejected();
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: both resumes passed the wait for an undecided cold resume before either claimed the
  // run, so the rejected one's preparation replaced the valid one's registry entry and deadline.
  it('a rejected and a valid resume started together leave the valid run its timeout', async () => {
    let releaseRejected!: () => void;
    const rejectedMayFinish = new Promise<void>(resolve => {
      releaseRejected = resolve;
    });
    let markToolStarted!: () => void;
    const toolStarted = new Promise<void>(resolve => {
      markToolStarted = resolve;
    });
    const abortedByDeadline: boolean[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        markToolStarted();
        const signal = context.abortSignal;
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 1500);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        abortedByDeadline.push(signal?.aborted ?? false);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-deadline-agent',
      name: 'Resume Deadline Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Confirmed']),
      tools: async ({ requestContext }) => {
        if (requestContext.get('tenant') === 'rejected-caller') await rejectedMayFinish;
        return { ask };
      },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        requestContext: new RequestContext([['tenant', 'acme']]),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      const rejected = durable.resume(
        initial.runId,
        { confirmed: 'yes' },
        { runId: initial.runId, requestContext: new RequestContext([['tenant', 'rejected-caller']]) },
      );
      const valid = durable.resume(
        initial.runId,
        { confirmed: true },
        {
          runId: initial.runId,
          requestContext: new RequestContext([['requestId', 'valid']]),
          modelSettings: { timeout: { totalMs: 300 } },
        },
      );
      await Promise.race([toolStarted, new Promise(resolve => setTimeout(resolve, 100))]);
      releaseRejected();

      // Whichever claims the run first, the invalid resume is refused and the valid one keeps its deadline.
      await expect(rejected).rejects.toBeInstanceOf(Error);
      await expect((await valid).output.getFullOutput()).rejects.toThrow('modelSettings.timeout.totalMs');
      await vi.waitFor(() => expect(abortedByDeadline).toEqual([true]));
    } finally {
      releaseRejected();
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: a second agent instance has its own local registry, so it rebuilt the run over the
  // accepted resume's shared registry entry, and its rollback then emptied that slot.
  it('a resume rejected on another agent instance leaves the accepted run its timeout', async () => {
    let releaseRejected!: () => void;
    const rejectedMayFinish = new Promise<void>(resolve => {
      releaseRejected = resolve;
    });
    let markToolStarted!: () => void;
    const toolStarted = new Promise<void>(resolve => {
      markToolStarted = resolve;
    });
    const abortedByDeadline: boolean[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        markToolStarted();
        const signal = context.abortSignal;
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 1500);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        abortedByDeadline.push(signal?.aborted ?? false);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-deadline-agent',
      name: 'Resume Deadline Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Confirmed']),
      tools: async ({ requestContext }) => {
        if (requestContext.get('tenant') === 'rejected-caller') await rejectedMayFinish;
        return { ask };
      },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        requestContext: new RequestContext([['tenant', 'acme']]),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);
      const otherInstance = new AgentClass({ agent, pubsub });
      otherInstance.__setMastra(host);

      const valid = durable.resume(
        initial.runId,
        { confirmed: true },
        {
          runId: initial.runId,
          untilIdle: true,
          requestContext: new RequestContext([['requestId', 'valid']]),
          modelSettings: { timeout: { totalMs: 300 } },
        },
      );
      const rejected = otherInstance.resume(
        initial.runId,
        { confirmed: 'yes' },
        { runId: initial.runId, requestContext: new RequestContext([['tenant', 'rejected-caller']]) },
      );
      await Promise.race([toolStarted, new Promise(resolve => setTimeout(resolve, 100))]);
      releaseRejected();

      // The invalid resume is refused and the accepted one still stops at its deadline.
      await expect(rejected).rejects.toBeInstanceOf(Error);
      await expect((await valid).output.getFullOutput()).rejects.toThrow('modelSettings.timeout.totalMs');
      await vi.waitFor(() => expect(abortedByDeadline).toEqual([true]));
    } finally {
      releaseRejected();
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: untilIdle accepted the resume, then the resume() it re-enters validated again; a tool
  // lookup failing there rejected the call after the run already carried the caller's context.
  it.each(['warm', 'cold'].flatMap(registry => [1, 2, 3].map(failingLookup => ({ registry, failingLookup }))))(
    'a refused untilIdle resume leaves the run as it was, whichever tool lookup fails ($registry registry, lookup $failingLookup)',
    async ({ registry, failingLookup }) => {
      const seenTenants: unknown[] = [];
      let flakyLookups = 0;
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          seenTenants.push(context.requestContext?.get('tenant'));
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-context-agent',
        name: 'Resume Context Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        // The flaky caller's tools load until the given lookup, then fail.
        tools: ({ requestContext }) => {
          if (requestContext.get('tenant') === 'flaky-caller' && ++flakyLookups >= failingLookup) {
            throw new Error('tool resolver offline');
          }
          return { ask };
        },
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Confirm', {
          closeOnSuspend: true,
          requestContext: new RequestContext([['tenant', 'acme']]),
        });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }

        const flaky = await durable
          .resume(
            initial.runId,
            { confirmed: true },
            {
              runId: initial.runId,
              untilIdle: true,
              requestContext: new RequestContext([['tenant', 'flaky-caller']]),
            },
          )
          .then(
            result => result.output,
            () => undefined,
          );

        if (flaky) {
          // An accepted resume runs the tool built for its own caller, never one built for another.
          const output = await flaky.getFullOutput();
          expect(output.error).toBeUndefined();
          expect(output.text).toBe('Confirmed');
          expect(seenTenants).toEqual(['flaky-caller']);
          return;
        }
        // A refused one leaves the run as it was for the next caller.
        const retry = await durable.resume(
          initial.runId,
          { confirmed: true },
          { runId: initial.runId, untilIdle: true, requestContext: new RequestContext([['requestId', 'retry']]) },
        );
        const resumed = await retry.output.getFullOutput();
        expect(resumed.text).toBe('Confirmed');
        expect(seenTenants).toEqual(['acme']);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a resume can fail before validation decides anything, here because the tool resolver
  // throws for the caller. The cold path rebuilt the run from that caller's context before failing.
  it.each(['warm', 'cold'].flatMap(registry => [false, true].map(untilIdle => ({ registry, untilIdle }))))(
    'a retry after a resume whose tools failed to load runs with the original context ($registry registry, untilIdle $untilIdle)',
    async ({ registry, untilIdle }) => {
      const seenTenants: unknown[] = [];
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          seenTenants.push(context.requestContext?.get('tenant'));
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-context-agent',
        name: 'Resume Context Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: ({ requestContext }) => {
          if (requestContext.get('tenant') === 'rejected-caller') throw new Error('tool resolver offline');
          return { ask };
        },
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Confirm', {
          closeOnSuspend: true,
          requestContext: new RequestContext([['tenant', 'acme']]),
        });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = { runId: initial.runId, ...(untilIdle ? { untilIdle: true } : {}) };

        await expect(
          durable.resume(
            initial.runId,
            { confirmed: true },
            { ...options, requestContext: new RequestContext([['tenant', 'rejected-caller']]) },
          ),
        ).rejects.toThrow('tool resolver offline');

        const retry = await durable.resume(
          initial.runId,
          { confirmed: true },
          { ...options, requestContext: new RequestContext([['requestId', 'retry']]) },
        );
        const resumed = await retry.output.getFullOutput();
        expect(resumed.error).toBeUndefined();
        expect(resumed.text).toBe('Confirmed');
        expect(seenTenants).toEqual(['acme']);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a cold resume on another agent instance published the entry it rebuilt for its caller to the
  // shared registry slot before deciding, and the accepted run's total deadline saved the turn through that
  // entry's output processors.
  it("an accepted run's deadline saves the turn with its own processors, not a concurrently rejected caller's", async () => {
    const processedFor: unknown[] = [];
    const rejectedLookupsDone = deferred();
    const rejectedMayFinish = deferred();
    const toolStarted = deferred();
    let rejectedLookups = 0;
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        toolStarted.resolve();
        const signal = context.abortSignal;
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 1500);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-deadline-processor-agent',
      name: 'Resume Deadline Processor Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Confirmed']),
      tools: async ({ requestContext }) => {
        // The rejected caller's preparation builds its tools, then stalls on its next lookup.
        if (requestContext.get('tenant') === 'rejected-caller' && ++rejectedLookups > 1) {
          rejectedLookupsDone.resolve();
          await rejectedMayFinish.promise;
        }
        return { ask };
      },
      outputProcessors: ({ requestContext }) => [
        {
          id: 'record-caller',
          processOutputResult: ({ messages }) => {
            processedFor.push(requestContext.get('tenant'));
            return messages;
          },
        },
      ],
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        requestContext: new RequestContext([['tenant', 'acme']]),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);
      const otherInstance = new AgentClass({ agent, pubsub });
      otherInstance.__setMastra(host);

      const valid = durable.resume(
        initial.runId,
        { confirmed: true },
        {
          runId: initial.runId,
          requestContext: new RequestContext([['tenant', 'valid-caller']]),
          modelSettings: { timeout: { totalMs: 300 } },
        },
      );
      const rejected = otherInstance
        .resume(
          initial.runId,
          { confirmed: 'yes' },
          { runId: initial.runId, requestContext: new RequestContext([['tenant', 'rejected-caller']]) },
        )
        .then(
          () => 'resumed',
          (error: unknown) => error,
        );
      // The accepted run reaches its deadline while the other caller may still be undecided.
      await expect((await valid).output.getFullOutput()).rejects.toThrow('modelSettings.timeout.totalMs');
      await Promise.race([rejectedLookupsDone.promise, new Promise(resolve => setTimeout(resolve, 100))]);
      rejectedMayFinish.resolve();
      expect(await rejected).toBeInstanceOf(Error);

      await vi.waitFor(() => expect(processedFor).toContain('valid-caller'));
      expect(processedFor).not.toContain('rejected-caller');
    } finally {
      rejectedMayFinish.resolve();
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: a run pinned to a stored version skipped the preflight, so data the pinned version's tool
  // rejects consumed the suspension. The pinned version's own tool must check it.
  it("checks resume data against the pinned version's tool, not the current one", async () => {
    const pinnedAnswers: unknown[] = [];
    const currentAsk = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        throw new Error('the current version must not answer a pinned run');
      },
    });
    const pinnedAsk = createTool({
      id: 'ask',
      description: 'Ask for approval',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        pinnedAnswers.push(context.agent.resumeData);
        return { approved: context.agent.resumeData.approved };
      },
    });
    const agent = new Agent({
      id: 'resume-pinned-agent',
      name: 'Resume Pinned Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Approved']),
      // The run starts on stored version v-pinned, whose tool asks for approval.
      tools: { ask: pinnedAsk },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    // As the editor resolves a stored version: a fork carrying that version's tools.
    vi.spyOn(host, 'resolveVersionedAgent').mockImplementation(async resolving => {
      const fork = resolving.__fork();
      fork.__setTools({ ask: pinnedAsk });
      fork.__setRawConfig({ resolvedVersionId: 'v-pinned' });
      fork.__markStoredVersionApplied();
      return fork as typeof resolving;
    });
    try {
      durable.__setRawConfig({ resolvedVersionId: 'v-pinned' });
      const initial = await durable.stream('Confirm', { closeOnSuspend: true });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      // A new version is published while the run is suspended; its tool takes a different answer.
      durable.__setRawConfig({ resolvedVersionId: 'v-current' });
      durable.__setTools({ ask: currentAsk });
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      // Valid for the current version, invalid for the pinned one that executes.
      await expect(durable.resume(initial.runId, { confirmed: true }, { runId: initial.runId })).rejects.toMatchObject({
        id: 'AGENT_RESUME_INVALID_DATA',
      });
      expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);

      const resumed = await (
        await durable.resume(initial.runId, { approved: true }, { runId: initial.runId, closeOnSuspend: true })
      ).output.getFullOutput();
      expect(resumed.error).toBeUndefined();
      expect(resumed.text).toBe('Approved');
      expect(pinnedAnswers).toEqual([{ approved: true }]);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: two resumes without a toolCallId both validated against call-1. The one that claimed the run
  // second did so after the first had run on to call-2, and resumed call-2 with data meant for call-1.
  it('two resumes of one suspension answer it once and leave the next suspension waiting', async () => {
    const answered: string[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        answered.push(context.agent.toolCallId);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-stale-agent',
      name: 'Resume Stale Agent',
      instructions: 'Ask for confirmation',
      model: createToolCallSequenceModel('ask', ['call-1', 'call-2'], 'Confirmed'),
      tools: { ask },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', { closeOnSuspend: true });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;

      const outcome = (attempt: Promise<{ output: { getFullOutput(): Promise<{ error?: unknown }> } }>) =>
        attempt.then(
          result => result.output.getFullOutput().then(output => output.error ?? 'answered'),
          (error: unknown) => error,
        );
      const options = { runId: initial.runId, closeOnSuspend: true };
      const outcomes = await Promise.all([
        outcome(durable.resume(initial.runId, { confirmed: true }, options)),
        outcome(durable.resume(initial.runId, { confirmed: false }, options)),
      ]);

      expect(answered).toEqual(['call-1']);
      expect(outcomes).toContainEqual(expect.objectContaining({ id: 'AGENT_RESUME_ALREADY_CLAIMED' }));
      const suspendedRuns = (await durable.listSuspendedRuns()).runs;
      expect(suspendedRuns).toHaveLength(1);
      expect(JSON.stringify(suspendedRuns[0])).toContain('call-2');
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  it('stale rejected resume does not seed the next caller context', async () => {
    const answered: string[] = [];
    const seenTenants: unknown[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        answered.push(context.agent.toolCallId);
        seenTenants.push(context.requestContext?.get('tenant'));
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-stale-agent',
      name: 'Resume Stale Agent',
      instructions: 'Ask for confirmation',
      model: createToolCallSequenceModel('ask', ['call-1', 'call-2'], 'Confirmed'),
      tools: { ask },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', { closeOnSuspend: true });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;

      const outcome = (attempt: Promise<{ output: { getFullOutput(): Promise<{ error?: unknown }> } }>) =>
        attempt.then(
          result => result.output.getFullOutput().then(output => output.error ?? 'answered'),
          (error: unknown) => error,
        );
      const options = { runId: initial.runId, closeOnSuspend: true };
      // Both callers send valid data and rebuild their tools asynchronously, so either may win.
      const tenants = ['caller-a', 'caller-b'];
      const outcomes = await Promise.all(
        tenants.map((tenant, index) =>
          outcome(
            durable.resume(
              initial.runId,
              { confirmed: index === 0 },
              { ...options, requestContext: new RequestContext([['tenant', tenant]]) },
            ),
          ),
        ),
      );

      expect(answered).toEqual(['call-1']);
      expect(outcomes.filter(result => result === 'answered')).toHaveLength(1);
      const winner = outcomes.indexOf('answered');
      expect(outcomes[1 - winner]).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
      expect(seenTenants).toEqual([tenants[winner]]);
      const suspendedRuns = (await durable.listSuspendedRuns()).runs;
      expect(suspendedRuns).toHaveLength(1);
      expect(JSON.stringify(suspendedRuns[0])).toContain('call-2');
      const next = await durable.resume(
        initial.runId,
        { confirmed: true },
        {
          ...options,
          requestContext: new RequestContext([['requestId', 'next-caller']]),
        },
      );
      const output = await next.output.getFullOutput();
      expect(output.error).toBeUndefined();
      expect(output.text).toBe('Confirmed');
      expect(answered).toEqual(['call-1', 'call-2']);
      // The next caller sets no tenant, so it inherits the winner's, never the refused caller's.
      expect(seenTenants).toEqual([tenants[winner], tenants[winner]]);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: resumes of a run another cold resume was rebuilding waited for that resume without a bound, so
  // a tool resolver that never answered held every later resume, even one whose caller had given up.
  it.each(['abort', 'deadline'] as const)(
    'a resume stops waiting on a stalled cold resume once its caller gives up (%s)',
    async giveUp => {
      const resolverStalled = deferred();
      const stalledResolver = deferred();
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-stalled-agent',
        name: 'Resume Stalled Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: async ({ requestContext }) => {
          if (requestContext.get('tenant') === 'stalled-caller') {
            resolverStalled.resolve();
            await stalledResolver.promise;
          }
          return { ask };
        },
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        durable.runRegistry.clear();
        globalRunRegistry.delete(initial.runId);

        const stalled = durable
          .resume(
            initial.runId,
            { confirmed: true },
            { runId: initial.runId, requestContext: new RequestContext([['tenant', 'stalled-caller']]) },
          )
          .catch(() => undefined);
        await resolverStalled.promise;

        const controller = new AbortController();
        const retry = durable.resume(
          initial.runId,
          { confirmed: true },
          {
            runId: initial.runId,
            abortSignal: controller.signal,
            modelSettings: { timeout: { totalMs: giveUp === 'deadline' ? 200 : 60_000 } },
          },
        );
        if (giveUp === 'abort') setTimeout(() => controller.abort(), 50);
        const settled = await Promise.race([
          retry.then(
            () => 'resumed',
            () => 'refused',
          ),
          new Promise(resolve => setTimeout(() => resolve('still waiting'), 3000)),
        ]);
        expect(settled).toBe('refused');
        expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);

        stalledResolver.resolve();
        await stalled;
      } finally {
        stalledResolver.resolve();
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a cold resume whose caller gave up while its tool resolver stalled kept preparing, and once the
  // resolver answered it registered the run it had rebuilt for that caller over the one a later resume built.
  it('a cold resume abandoned during a stalled resolver leaves later resumes the original context', async () => {
    const seenTenants: unknown[] = [];
    const resolverStalled = deferred();
    const stalledResolver = deferred();
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        seenTenants.push(context.requestContext?.get('tenant'));
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-abandoned-agent',
      name: 'Resume Abandoned Agent',
      instructions: 'Ask for confirmation',
      model: createToolCallSequenceModel('ask', ['call-1', 'call-2'], 'Confirmed'),
      tools: async ({ requestContext }) => {
        if (requestContext.get('tenant') === 'stalled-caller') {
          resolverStalled.resolve();
          await stalledResolver.promise;
        }
        return { ask };
      },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        requestContext: new RequestContext([['tenant', 'acme']]),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      const controller = new AbortController();
      const abandoned = durable.resume(
        initial.runId,
        { confirmed: true },
        {
          runId: initial.runId,
          abortSignal: controller.signal,
          requestContext: new RequestContext([['tenant', 'stalled-caller']]),
        },
      );
      await resolverStalled.promise;
      controller.abort();
      await expect(abandoned).rejects.toBeDefined();

      // A later caller resumes call-1 and the run suspends again on call-2.
      const first = await (
        await durable.resume(initial.runId, { confirmed: true }, { runId: initial.runId, closeOnSuspend: true })
      ).output.getFullOutput();
      expect(first.error).toBeUndefined();
      // The abandoned preparation finishes now.
      stalledResolver.resolve();
      await new Promise(resolve => setTimeout(resolve, 50));

      const second = await (
        await durable.resume(
          initial.runId,
          { confirmed: true },
          { runId: initial.runId, requestContext: new RequestContext([['requestId', 'next']]) },
        )
      ).output.getFullOutput();
      expect(second.error).toBeUndefined();
      expect(second.text).toBe('Confirmed');
      expect(seenTenants).toEqual(['acme', 'acme']);
    } finally {
      stalledResolver.resolve();
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: the warm preflight resolved the agent's tools again and checked their schema, while the run
  // kept executing the tool it suspended in. A changed definition then rejected answers the suspended tool
  // accepts. When this call's request rebuilds the tool, the rebuilt one executes and is the one to check.
  it.each([false, true])(
    'checks resume data against the tool that will execute (request context passed: %s)',
    async passRequestContext => {
      const answers: unknown[] = [];
      const makeAsk = (version: 'v1' | 'v2') =>
        createTool({
          id: 'ask',
          description: 'Ask for confirmation',
          inputSchema: z.object({ action: z.string() }),
          suspendSchema: z.object({}),
          resumeSchema:
            version === 'v1' ? z.object({ confirmed: z.boolean() }) : z.object({ choice: z.enum(['yes', 'no']) }),
          execute: async (_input, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({});
            answers.push({ version, ...context.agent.resumeData });
            return { ok: true };
          },
        });
      let definition: 'v1' | 'v2' = 'v1';
      const agent = new Agent({
        id: 'resume-retained-tool-agent',
        name: 'Resume Retained Tool Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: () => ({ ask: makeAsk(definition) }),
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        // The tool's definition changes while the run is suspended.
        definition = 'v2';

        const options = {
          runId: initial.runId,
          closeOnSuspend: true,
          ...(passRequestContext ? { requestContext: new RequestContext([['requestId', 'resume']]) } : {}),
        };
        const [executing, other] = passRequestContext
          ? [{ choice: 'yes' }, { confirmed: true }]
          : [{ confirmed: true }, { choice: 'yes' }];
        // An answer only the tool that will not execute accepts is refused.
        await expect(durable.resume(initial.runId, other, options)).rejects.toMatchObject({
          id: 'AGENT_RESUME_INVALID_DATA',
        });
        const resumed = await (await durable.resume(initial.runId, executing, options)).output.getFullOutput();
        expect(resumed.error).toBeUndefined();
        expect(resumed.text).toBe('Confirmed');
        expect(answers).toEqual([{ version: passRequestContext ? 'v2' : 'v1', ...executing }]);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );
  // Technical: a cold resume awaited the authorization provider outside the wait that stops when its caller
  // gives up, so a stalled provider left the attempt undecided after an abort or deadline, and every later
  // resume of the run waited on it.
  it.each(['abort', 'deadline'] as const)(
    'a caller who gives up on a stalled authorization check frees the run for the next caller (%s)',
    async giveUp => {
      const executedFor: unknown[] = [];
      const authorizationStalled = deferred();
      const stalledAuthorization = deferred();
      const fga: IFGAProvider = {
        check: async () => true,
        filterAccessible: async () => [],
        require: async (user, input) => {
          const id = user && typeof user === 'object' && 'id' in user ? user.id : undefined;
          if (input.permission === MastraFGAPermissions.AGENTS_EXECUTE && id === 'stalled-user') {
            authorizationStalled.resolve();
            await stalledAuthorization.promise;
          }
        },
      };
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          executedFor.push(userIdOf(context.requestContext));
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-stalled-authorization-agent',
        name: 'Resume Stalled Authorization Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: { ask },
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), server: { fga }, logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true, requestContext: signedIn('starter') });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        durable.runRegistry.clear();
        globalRunRegistry.delete(initial.runId);

        const controller = new AbortController();
        const stalled = durable.resume(
          initial.runId,
          { confirmed: true },
          {
            runId: initial.runId,
            abortSignal: controller.signal,
            requestContext: signedIn('stalled-user'),
            modelSettings: { timeout: { totalMs: giveUp === 'deadline' ? 200 : 60_000 } },
          },
        );
        await authorizationStalled.promise;
        if (giveUp === 'abort') controller.abort();
        const settled = await Promise.race([
          stalled.then(
            () => 'resumed',
            () => 'refused',
          ),
          new Promise(resolve => setTimeout(() => resolve('still waiting'), 3000)),
        ]);
        expect(settled).toBe('refused');

        // The next caller is not held back by the abandoned attempt, and is still authorized itself.
        const next = await (
          await durable.resume(
            initial.runId,
            { confirmed: true },
            { runId: initial.runId, requestContext: signedIn('starter') },
          )
        ).output.getFullOutput();
        expect(next.error).toBeUndefined();
        expect(next.text).toBe('Confirmed');

        // The provider answering late changes nothing.
        stalledAuthorization.resolve();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(executedFor).toEqual(['starter']);
      } finally {
        stalledAuthorization.resolve();
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a warm resume swapped in only the tools its caller's build produced. A tool the starting
  // caller's resolver built and this caller's leaves out kept its closure over the starting request and
  // executed for the resuming caller. A cold resume rebuilt the run without the tool, and the tool-call
  // step reported it not found and consumed the suspension, so no caller could answer it any more.
  it.each(['warm', 'cold'] as const)(
    'a caller whose tools leave out the suspended tool is refused, and the run waits for one who has it (%s)',
    async registry => {
      const executedFor: unknown[] = [];
      const deleteAccount = createTool({
        id: 'deleteAccount',
        description: 'Delete an account',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          executedFor.push(userIdOf(context.requestContext));
          return { deleted: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-admin-tool-agent',
        name: 'Resume Admin Tool Agent',
        instructions: 'Delete the account once confirmed',
        model: createSuspendingThenTextModel('deleteAccount', ['Deleted']),
        // Only admins get the tool.
        tools: ({ requestContext }) => (roleOf(requestContext) === 'admin' ? { deleteAccount } : {}),
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Delete it', {
          closeOnSuspend: true,
          requestContext: signedIn('alice', 'admin'),
        });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = { runId: initial.runId, toolCallId: 'call-1' };

        await expect(
          durable.resume(initial.runId, { confirmed: true }, { ...options, requestContext: signedIn('guest') }),
        ).rejects.toMatchObject({ id: 'AGENT_RESUME_TOOL_UNAVAILABLE' });
        expect(executedFor).toEqual([]);
        expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);

        const resumed = await (
          await durable.resume(
            initial.runId,
            { confirmed: true },
            { ...options, requestContext: signedIn('bob', 'admin') },
          )
        ).output.getFullOutput();
        expect(resumed.error).toBeUndefined();
        expect(resumed.text).toBe('Deleted');
        expect(executedFor).toEqual(['bob']);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: a warm run kept the per-call toolsets its starting request resolved, including those the
  // agent's dynamic defaultOptions gave the starting caller, and rebuilt them for the resuming caller. A
  // guest resume therefore rebuilt and ran an admin-only tool under the guest's identity.
  it("a tool the agent's defaultOptions give only the starting caller is refused for a caller they leave it out for", async () => {
    const executedFor: unknown[] = [];
    const deleteAccount = createTool({
      id: 'deleteAccount',
      description: 'Delete an account',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        executedFor.push(userIdOf(context.requestContext));
        return { deleted: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-admin-default-toolset-agent',
      name: 'Resume Admin Default Toolset Agent',
      instructions: 'Delete the account once confirmed',
      model: createSuspendingThenTextModel('deleteAccount', ['Deleted']),
      // Only admins get the toolset.
      defaultOptions: ({ requestContext }) =>
        roleOf(requestContext) === 'admin' ? { toolsets: { admin: { deleteAccount } } } : {},
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Delete it', {
        closeOnSuspend: true,
        requestContext: signedIn('alice', 'admin'),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      const options = { runId: initial.runId, toolCallId: 'call-1' };

      await expect(
        durable.resume(initial.runId, { confirmed: true }, { ...options, requestContext: signedIn('guest') }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_TOOL_UNAVAILABLE' });
      expect(executedFor).toEqual([]);
      expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);

      const resumed = await (
        await durable.resume(
          initial.runId,
          { confirmed: true },
          { ...options, requestContext: signedIn('bob', 'admin') },
        )
      ).output.getFullOutput();
      expect(resumed.error).toBeUndefined();
      expect(resumed.text).toBe('Deleted');
      expect(executedFor).toEqual(['bob']);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: a warm resume rebuilt the run's tools only when it passed a request context, delegation,
  // hooks or dropped the starting user. Toolsets or client tools passed to the resume alone were ignored,
  // so the run kept executing and offering the starting call's definitions.
  it("toolsets passed to a resume replace the starting call's toolset of the same name", async () => {
    const executed: string[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        executed.push('starting');
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const replacement = createTool({
      id: 'ask',
      description: 'Replacement confirmation tool',
      inputSchema: z.object({ action: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async () => {
        executed.push('replacement');
        return { confirmed: true };
      },
    });
    const agent = new Agent({
      id: 'resume-replaced-toolset-agent',
      name: 'Resume Replaced Toolset Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Confirmed']),
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', { closeOnSuspend: true, toolsets: { extra: { ask } } });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;

      const resumed = await (
        await durable.resume(
          initial.runId,
          { confirmed: true },
          { runId: initial.runId, toolCallId: 'call-1', toolsets: { extra: { ask: replacement } } },
        )
      ).output.getFullOutput();
      expect(resumed.error).toBeUndefined();
      expect(resumed.text).toBe('Confirmed');
      expect(executed).toEqual(['replacement']);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: as above, for client tools. The model kept receiving the starting call's definition.
  it("client tools passed to a resume replace the starting call's definition the model sees", async () => {
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const model = createSuspendingThenTextModel('ask', ['Confirmed']);
    const requests = vi.spyOn(model, 'doStream');
    const agent = new Agent({
      id: 'resume-replaced-client-tool-agent',
      name: 'Resume Replaced Client Tool Agent',
      instructions: 'Ask for confirmation',
      model,
      tools: { ask },
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        clientTools: {
          render: { description: 'Starting client definition', inputSchema: z.object({ value: z.string() }) },
        },
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;

      const resumed = await (
        await durable.resume(
          initial.runId,
          { confirmed: true },
          {
            runId: initial.runId,
            toolCallId: 'call-1',
            clientTools: {
              render: { description: 'Resuming client definition', inputSchema: z.object({ value: z.number() }) },
            },
          },
        )
      ).output.getFullOutput();
      expect(resumed.error).toBeUndefined();
      expect(resumed.text).toBe('Confirmed');
      const offered = requests.mock.calls.at(-1)?.[0].tools ?? [];
      expect(
        offered.filter(tool => tool.name === 'render').map(tool => 'description' in tool && tool.description),
      ).toEqual(['Resuming client definition']);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: as above, for a tool the model calls after the resumed one. The resumed segment offered and
  // executed the starting caller's tool to a caller whose own tools leave it out.
  it("a resumed run never runs a tool the resuming caller's tools leave out", async () => {
    const executed: Array<{ tool: string; user: unknown }> = [];
    const record = (tool: string) =>
      createTool({
        id: tool,
        description: tool,
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (tool === 'ask' && !context?.agent?.resumeData) return context?.agent?.suspend({});
          executed.push({ tool, user: userIdOf(context?.requestContext) });
          return { ok: true };
        },
      });
    const ask = record('ask');
    const deleteAccount = record('deleteAccount');
    const agent = new Agent({
      id: 'resume-later-admin-tool-agent',
      name: 'Resume Later Admin Tool Agent',
      instructions: 'Confirm, then delete the account',
      model: createMixedToolCallModel(
        [
          { toolName: 'ask', toolCallId: 'call-1' },
          { toolName: 'deleteAccount', toolCallId: 'call-2' },
        ],
        'Finished',
      ),
      tools: ({ requestContext }) => (roleOf(requestContext) === 'admin' ? { ask, deleteAccount } : { ask }),
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Delete it', {
        closeOnSuspend: true,
        requestContext: signedIn('alice', 'admin'),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;

      const resumed = await (
        await durable.resume(
          initial.runId,
          { confirmed: true },
          { runId: initial.runId, toolCallId: 'call-1', requestContext: signedIn('guest') },
        )
      ).output.getFullOutput();
      expect(resumed.text).toBe('Finished');
      expect(executed).toEqual([{ tool: 'ask', user: 'guest' }]);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: a toolset passed only to the starting call is kept by a warm run. Once the resume rebuilt the
  // run's tools for its caller, that toolset's tool still held the starting caller's closure.
  it('a toolset passed only to the starting call runs for the resuming caller, not the starting one', async () => {
    const executedFor: unknown[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        executedFor.push(userIdOf(context.requestContext));
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const agent = new Agent({
      id: 'resume-retained-toolset-agent',
      name: 'Resume Retained Toolset Agent',
      instructions: 'Ask for confirmation',
      model: createSuspendingThenTextModel('ask', ['Confirmed']),
    });
    const pubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent, pubsub });
    const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    try {
      const initial = await durable.stream('Confirm', {
        closeOnSuspend: true,
        toolsets: { extra: { ask } },
        requestContext: signedIn('alice'),
      });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;

      const resumed = await (
        await durable.resume(
          initial.runId,
          { confirmed: true },
          { runId: initial.runId, toolCallId: 'call-1', requestContext: signedIn('bob') },
        )
      ).output.getFullOutput();
      expect(resumed.error).toBeUndefined();
      expect(resumed.text).toBe('Confirmed');
      expect(executedFor).toEqual(['bob']);
    } finally {
      await host.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
    }
  });

  // Technical: an unlabeled cold resume chose the call to answer from a snapshot read after it rebuilt the
  // run. Another process resumed the run and it suspended on a later call meanwhile, so the data meant for
  // the first call answered the later one. With the call named, DurableAgent found the named call gone,
  // validated nothing and ran the later call with it; EventedAgent failed on the missing resume label.
  it.each([
    { label: 'unlabeled', toolCallId: undefined },
    { label: 'naming call-1', toolCallId: 'call-1' },
  ])(
    'a cold resume ($label) is refused when another process moves the run on while it prepares',
    async ({ toolCallId }) => {
      const answered: string[] = [];
      const preparing = deferred();
      const mayFinish = deferred();
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          answered.push(context.agent.toolCallId);
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const makeAgent = (toolCallIds: string[]) =>
        new Agent({
          id: 'resume-moved-on-agent',
          name: 'Resume Moved On Agent',
          instructions: 'Ask for confirmation',
          model: createToolCallSequenceModel('ask', toolCallIds, 'Confirmed'),
          tools: async ({ requestContext }) => {
            if (requestContext.get('tenant') === 'slow-caller') {
              preparing.resolve();
              await mayFinish.promise;
            }
            return { ask };
          },
        });
      // Two processes running the same agent on one database.
      const storage = new InMemoryStore();
      const pubsub = new EventEmitterPubSub();
      const otherPubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent: makeAgent(['call-1', 'call-2']), pubsub });
      const host = new Mastra({ agents: { durable }, storage, logger: false });
      const otherDurable = new AgentClass({ agent: makeAgent(['call-2']), pubsub: otherPubsub });
      const otherHost = new Mastra({ agents: { durable: otherDurable }, storage, logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        durable.runRegistry.clear();
        globalRunRegistry.delete(initial.runId);

        const slow = durable
          .resume(
            initial.runId,
            { confirmed: false },
            { runId: initial.runId, toolCallId, requestContext: new RequestContext([['tenant', 'slow-caller']]) },
          )
          .then(
            () => 'resumed',
            (error: unknown) => error,
          );
        await preparing.promise;

        // The other process answers call-1, and the run suspends again on call-2.
        const moved = await (
          await otherDurable.resume(initial.runId, { confirmed: true }, { runId: initial.runId, closeOnSuspend: true })
        ).output.getFullOutput();
        expect(moved.error).toBeUndefined();
        expect(answered).toEqual(['call-1']);

        mayFinish.resolve();
        expect(await slow).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
        expect(answered).toEqual(['call-1']);
        const suspendedRuns = (await durable.listSuspendedRuns()).runs;
        expect(suspendedRuns).toHaveLength(1);
        expect(JSON.stringify(suspendedRuns[0])).toContain('call-2');
      } finally {
        mayFinish.resolve();
        await host.shutdown({ drainTimeout: 1000 });
        await otherHost.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
        await otherPubsub.close();
      }
    },
  );

  // Technical: a cold resume of a run pinned to a stored version handed off to the pinned agent before it
  // read which call it answers, and that agent read storage again after the (slow) version lookup. Another
  // process had answered call-1 and the run waited on call-2 by then, so this caller's data answered it.
  it('a resume of a pinned-version run is refused when another process moves the run on during the version lookup', async () => {
    const answered: string[] = [];
    const lookingUp = deferred();
    const mayFinish = deferred();
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        answered.push(context.agent.toolCallId);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const makeAgent = (toolCallIds: string[]) =>
      new Agent({
        id: 'resume-pinned-moved-on-agent',
        name: 'Resume Pinned Moved On Agent',
        instructions: 'Ask for confirmation',
        model: createToolCallSequenceModel('ask', toolCallIds, 'Confirmed'),
        tools: { ask },
      });
    // Two processes running the same agent on one database.
    const storage = new InMemoryStore();
    const pubsub = new EventEmitterPubSub();
    const otherPubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent: makeAgent(['call-1', 'call-2']), pubsub });
    const host = new Mastra({ agents: { durable }, storage, logger: false });
    const otherDurable = new AgentClass({ agent: makeAgent(['call-2']), pubsub: otherPubsub });
    const otherHost = new Mastra({ agents: { durable: otherDurable }, storage, logger: false });
    try {
      durable.__setRawConfig({ resolvedVersionId: 'v-pinned' });
      // The version lookup is slow, as a stored-version read can be.
      vi.spyOn(host, 'resolveVersionedAgent').mockImplementation(async resolving => {
        lookingUp.resolve();
        await mayFinish.promise;
        const fork = resolving.__fork();
        fork.__setRawConfig({ resolvedVersionId: 'v-pinned' });
        fork.__markStoredVersionApplied();
        return fork as typeof resolving;
      });
      const initial = await durable.stream('Confirm', { closeOnSuspend: true });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      // A newer version is published, so the cold resume looks the pinned one up.
      durable.__setRawConfig({ resolvedVersionId: 'v-current' });
      otherDurable.__setRawConfig({ resolvedVersionId: 'v-pinned' });
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      const slow = durable.resume(initial.runId, { confirmed: false }, { runId: initial.runId }).then(
        () => 'resumed',
        (error: unknown) => error,
      );
      await lookingUp.promise;

      // The other process answers call-1, and the run suspends again on call-2.
      const moved = await (
        await otherDurable.resume(initial.runId, { confirmed: true }, { runId: initial.runId, closeOnSuspend: true })
      ).output.getFullOutput();
      expect(moved.error).toBeUndefined();
      expect(answered).toEqual(['call-1']);

      mayFinish.resolve();
      expect(await slow).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
      expect(answered).toEqual(['call-1']);
      const suspendedRuns = (await durable.listSuspendedRuns()).runs;
      expect(suspendedRuns).toHaveLength(1);
      expect(JSON.stringify(suspendedRuns[0])).toContain('call-2');
    } finally {
      mayFinish.resolve();
      await host.shutdown({ drainTimeout: 1000 });
      await otherHost.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
      await otherPubsub.close();
    }
  });

  // Technical: an unlabeled resume that began while two calls were suspended bound to nothing, and once
  // another process answered one of them, it bound to the call that remained and answered it with data
  // the caller never meant for that call.
  it('an unlabeled resume begun with two calls waiting does not answer the one left after another process answers the other', async () => {
    const answered: string[] = [];
    const preparing = deferred();
    const mayFinish = deferred();
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        answered.push(context.agent.toolCallId);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
    // The model asks twice in one step, so both calls wait at once.
    const askTwice = () =>
      new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            ...['call-1', 'call-2'].map(toolCallId => ({
              type: 'tool-call' as const,
              toolCallId,
              toolName: 'ask',
              input: JSON.stringify({ action: 'continue' }),
            })),
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ]),
        }),
      });
    const makeAgent = (model: LanguageModelV2) =>
      new Agent({
        id: 'resume-two-waiting-agent',
        name: 'Resume Two Waiting Agent',
        instructions: 'Ask for confirmation',
        model,
        defaultOptions: { toolCallConcurrency: 2 },
        tools: async ({ requestContext }) => {
          if (requestContext.get('tenant') === 'slow-caller') {
            preparing.resolve();
            await mayFinish.promise;
          }
          return { ask };
        },
      });
    // Two processes running the same agent on one database.
    const storage = new InMemoryStore();
    const pubsub = new EventEmitterPubSub();
    const otherPubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent: makeAgent(askTwice()), pubsub });
    const host = new Mastra({ agents: { durable }, storage, logger: false });
    const otherDurable = new AgentClass({
      agent: makeAgent(createToolCallSequenceModel('ask', [], 'Confirmed')),
      pubsub: otherPubsub,
    });
    const otherHost = new Mastra({ agents: { durable: otherDurable }, storage, logger: false });
    try {
      const initial = await durable.stream('Confirm', { closeOnSuspend: true });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      const waiting = JSON.stringify((await durable.listSuspendedRuns()).runs);
      expect(waiting).toContain('call-1');
      expect(waiting).toContain('call-2');
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      const slow = durable
        .resume(
          initial.runId,
          { confirmed: false },
          { runId: initial.runId, requestContext: new RequestContext([['tenant', 'slow-caller']]) },
        )
        .then(
          () => 'resumed',
          (error: unknown) => error,
        );
      await preparing.promise;

      // The other process answers call-1, and call-2 is left waiting.
      const moved = await otherDurable.resume(
        initial.runId,
        { confirmed: true },
        { runId: initial.runId, toolCallId: 'call-1', closeOnSuspend: true },
      );
      await drain(moved.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      const remaining = JSON.stringify((await otherDurable.listSuspendedRuns()).runs);
      expect(remaining).toContain('call-2');
      expect(remaining).not.toContain('call-1');
      expect(answered).toEqual(['call-1']);

      mayFinish.resolve();
      expect(await slow).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
      expect(answered).toEqual(['call-1']);
      const suspendedRuns = (await durable.listSuspendedRuns()).runs;
      expect(suspendedRuns).toHaveLength(1);
      expect(JSON.stringify(suspendedRuns[0])).toContain('call-2');
    } finally {
      mayFinish.resolve();
      await host.shutdown({ drainTimeout: 1000 });
      await otherHost.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
      await otherPubsub.close();
    }
  });

  // Technical: the wait for an undecided cold resume was keyed by run ID alone, so a stalled cold resume on
  // one Mastra host held up every resume of the same caller-supplied run ID on another host in the process.
  // With the tool call named, the process-wide in-flight marker for that run and tool call ID refused the
  // other host's resume outright as a duplicate.
  it.each([
    { label: 'unlabeled', stalledToolCallId: undefined },
    { label: 'naming the same tool call', stalledToolCallId: 'call-1' },
  ])(
    'a stalled cold resume ($label) on one host does not hold up a run with the same ID on another host',
    async ({ stalledToolCallId }) => {
      const runId = `shared-run-${crypto.randomUUID()}`;
      const resolverStalled = deferred();
      const stalledResolver = deferred();
      const makeHost = () => {
        const ask = createTool({
          id: 'ask',
          description: 'Ask for confirmation',
          inputSchema: z.object({ action: z.string() }),
          suspendSchema: z.object({}),
          resumeSchema: z.object({ confirmed: z.boolean() }),
          execute: async (_input, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({});
            return { confirmed: context.agent.resumeData.confirmed };
          },
        });
        const agent = new Agent({
          id: 'resume-shared-id-agent',
          name: 'Resume Shared Id Agent',
          instructions: 'Ask for confirmation',
          model: createSuspendingThenTextModel('ask', ['Confirmed']),
          tools: async ({ requestContext }) => {
            if (requestContext.get('tenant') === 'stalled-caller') {
              resolverStalled.resolve();
              await stalledResolver.promise;
            }
            return { ask };
          },
        });
        const pubsub = new EventEmitterPubSub();
        const durable = new AgentClass({ agent, pubsub });
        const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
        return { durable, host, pubsub };
      };
      const first = makeHost();
      const second = makeHost();
      try {
        const firstRun = await first.durable.stream('Confirm', { runId, closeOnSuspend: true });
        await drain(firstRun.output.fullStream);
        await globalRunRegistry.get(runId)?.workflowExecution;
        first.durable.runRegistry.clear();
        globalRunRegistry.delete(runId);
        const secondRun = await second.durable.stream('Confirm', { runId, closeOnSuspend: true });
        await drain(secondRun.output.fullStream);
        await globalRunRegistry.get(runId)?.workflowExecution;

        const stalled = first.durable
          .resume(
            runId,
            { confirmed: true },
            {
              runId,
              toolCallId: stalledToolCallId,
              requestContext: new RequestContext([['tenant', 'stalled-caller']]),
            },
          )
          .then(
            result => result.output.getFullOutput(),
            () => undefined,
          );
        await resolverStalled.promise;

        const resumed = await Promise.race([
          second.durable
            .resume(runId, { confirmed: true }, { runId, toolCallId: 'call-1' })
            .then(result => result.output.getFullOutput())
            .then(output => output.text),
          new Promise(resolve => setTimeout(() => resolve('still waiting'), 3000)),
        ]);
        expect(resumed).toBe('Confirmed');

        stalledResolver.resolve();
        expect((await stalled)?.text).toBe('Confirmed');
      } finally {
        stalledResolver.resolve();
        await first.host.shutdown({ drainTimeout: 1000 });
        await second.host.shutdown({ drainTimeout: 1000 });
        await first.pubsub.close();
        await second.pubsub.close();
      }
    },
  );

  // Technical: a cold resume bound itself to the suspended call by tool call ID only. Another process
  // answered the call while this resume rebuilt its tools, and the tool suspended again under the same
  // tool call ID, so the bound call still looked suspended and this caller's data answered the second
  // question. The binding now names the suspension itself (when the step or foreach iteration suspended
  // and resumed), which changes when the call suspends again.
  it.each([
    { label: 'unlabeled', toolCallId: undefined },
    { label: 'naming call-1', toolCallId: 'call-1' },
  ])(
    'a cold resume ($label) does not answer the next question the same tool asks after another process answered the first',
    async ({ toolCallId }) => {
      const answered: Array<{ phase: unknown; confirmed: boolean }> = [];
      const preparing = deferred();
      const mayFinish = deferred();
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation twice',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({ phase: z.number() }),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ phase: 1 });
          const phase = context.agent.suspendPayload?.phase;
          answered.push({ phase, confirmed: context.agent.resumeData.confirmed });
          if (phase === 1) return context.agent.suspend({ phase: 2 });
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const makeAgent = (toolCallIds: string[]) =>
        new Agent({
          id: 'resume-asks-twice-agent',
          name: 'Resume Asks Twice Agent',
          instructions: 'Ask for confirmation',
          model: createToolCallSequenceModel('ask', toolCallIds, 'Confirmed'),
          tools: async ({ requestContext }) => {
            if (requestContext.get('tenant') === 'slow-caller') {
              preparing.resolve();
              await mayFinish.promise;
            }
            return { ask };
          },
        });
      // Two processes running the same agent on one database.
      const storage = new InMemoryStore();
      const pubsub = new EventEmitterPubSub();
      const otherPubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent: makeAgent(['call-1']), pubsub });
      const host = new Mastra({ agents: { durable }, storage, logger: false });
      const otherDurable = new AgentClass({ agent: makeAgent([]), pubsub: otherPubsub });
      const otherHost = new Mastra({ agents: { durable: otherDurable }, storage, logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        durable.runRegistry.clear();
        globalRunRegistry.delete(initial.runId);

        const slow = durable
          .resume(
            initial.runId,
            { confirmed: false },
            {
              runId: initial.runId,
              toolCallId,
              closeOnSuspend: true,
              requestContext: new RequestContext([['tenant', 'slow-caller']]),
            },
          )
          .then(
            () => 'resumed',
            (error: unknown) => error,
          );
        await preparing.promise;

        // The other process answers the first question, and the same tool call asks the second.
        const moved = await (
          await otherDurable.resume(initial.runId, { confirmed: true }, { runId: initial.runId, closeOnSuspend: true })
        ).output.getFullOutput();
        expect(moved.error).toBeUndefined();
        expect((await durable.listSuspendedRuns()).runs[0]?.toolCalls).toEqual([
          expect.objectContaining({ toolCallId: 'call-1', suspendPayload: { phase: 2 } }),
        ]);

        mayFinish.resolve();
        expect(await slow).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
        expect(answered).toEqual([{ phase: 1, confirmed: true }]);
        // The second question still waits, and a caller who sees it can answer it.
        expect((await durable.listSuspendedRuns()).runs[0]?.toolCalls).toEqual([
          expect.objectContaining({ toolCallId: 'call-1', suspendPayload: { phase: 2 } }),
        ]);
        const answer = await (
          await otherDurable.resume(
            initial.runId,
            { confirmed: true },
            { runId: initial.runId, toolCallId: 'call-1', closeOnSuspend: true },
          )
        ).output.getFullOutput();
        expect(answer.error).toBeUndefined();
        expect(answer.text).toBe('Confirmed');
        expect(answered).toEqual([
          { phase: 1, confirmed: true },
          { phase: 2, confirmed: true },
        ]);
      } finally {
        mayFinish.resolve();
        await host.shutdown({ drainTimeout: 1000 });
        await otherHost.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
        await otherPubsub.close();
      }
    },
  );

  // Neighbor of the case above: binding to one suspension must not refuse a resume of a call another
  // process left alone, even though it answered a sibling call of the same model step meanwhile.
  it('a cold resume naming one of two waiting calls still answers it after another process answers the other', async () => {
    const answered: string[] = [];
    const preparing = deferred();
    const mayFinish = deferred();
    const ask = createTool({
      id: 'ask',
      description: 'Ask for confirmation',
      inputSchema: z.object({ action: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({});
        answered.push(context.agent.toolCallId);
        return { confirmed: context.agent.resumeData.confirmed };
      },
    });
    const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
    // The model asks twice in one step, so both calls wait at once, then answers in text.
    let modelCalls = 0;
    const askTwiceThenConfirm = () =>
      new MockLanguageModelV2({
        doStream: async () => {
          const first = modelCalls++ === 0;
          return {
            stream: convertArrayToReadableStream(
              first
                ? [
                    { type: 'stream-start' as const, warnings: [] },
                    ...['call-1', 'call-2'].map(toolCallId => ({
                      type: 'tool-call' as const,
                      toolCallId,
                      toolName: 'ask',
                      input: JSON.stringify({ action: 'continue' }),
                    })),
                    { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
                  ]
                : [
                    { type: 'stream-start' as const, warnings: [] },
                    { type: 'text-start' as const, id: 'text-1' },
                    { type: 'text-delta' as const, id: 'text-1', delta: 'Confirmed' },
                    { type: 'text-end' as const, id: 'text-1' },
                    { type: 'finish' as const, finishReason: 'stop' as const, usage },
                  ],
            ),
          };
        },
      });
    const makeAgent = (model: LanguageModelV2) =>
      new Agent({
        id: 'resume-two-waiting-agent',
        name: 'Resume Two Waiting Agent',
        instructions: 'Ask for confirmation',
        model,
        defaultOptions: { toolCallConcurrency: 2 },
        tools: async ({ requestContext }) => {
          if (requestContext.get('tenant') === 'slow-caller') {
            preparing.resolve();
            await mayFinish.promise;
          }
          return { ask };
        },
      });
    // Two processes running the same agent on one database.
    const storage = new InMemoryStore();
    const pubsub = new EventEmitterPubSub();
    const otherPubsub = new EventEmitterPubSub();
    const durable = new AgentClass({ agent: makeAgent(askTwiceThenConfirm()), pubsub });
    const host = new Mastra({ agents: { durable }, storage, logger: false });
    const otherDurable = new AgentClass({
      agent: makeAgent(createToolCallSequenceModel('ask', [], 'Confirmed')),
      pubsub: otherPubsub,
    });
    const otherHost = new Mastra({ agents: { durable: otherDurable }, storage, logger: false });
    try {
      const initial = await durable.stream('Confirm', { closeOnSuspend: true });
      await drain(initial.output.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      durable.runRegistry.clear();
      globalRunRegistry.delete(initial.runId);

      const slow = durable
        .resume(
          initial.runId,
          { confirmed: false },
          {
            runId: initial.runId,
            toolCallId: 'call-2',
            requestContext: new RequestContext([['tenant', 'slow-caller']]),
          },
        )
        .then(
          result => result.output.getFullOutput(),
          (error: unknown) => error,
        );
      await preparing.promise;

      // The other process answers call-1, and call-2 is left waiting.
      const moved = await otherDurable.resume(
        initial.runId,
        { confirmed: true },
        { runId: initial.runId, toolCallId: 'call-1', closeOnSuspend: true },
      );
      await drain(moved.fullStream);
      await globalRunRegistry.get(initial.runId)?.workflowExecution;
      expect(answered).toEqual(['call-1']);

      mayFinish.resolve();
      expect(await slow).toMatchObject({ text: 'Confirmed', error: undefined });
      expect(answered).toEqual(['call-1', 'call-2']);
      expect((await durable.listSuspendedRuns()).runs).toEqual([]);
    } finally {
      mayFinish.resolve();
      await host.shutdown({ drainTimeout: 1000 });
      await otherHost.shutdown({ drainTimeout: 1000 });
      await pubsub.close();
      await otherPubsub.close();
    }
  });

  // Technical: a cold resume skipped the unavailable-tool check for every approval, since a delegated
  // approval names the sub-agent's tool. A direct `requireApproval` tool's approval names this agent's
  // tool, so a caller without it got past the check, and the tool-call step reported ToolNotFoundError,
  // consumed the approval and finished the run. Only approvals a running tool asks for skip the check now.
  it.each(['warm', 'cold'] as const)(
    'a caller whose tools leave out an approval-gated tool cannot approve it, and the run waits for one who has it (%s)',
    async registry => {
      const executedFor: unknown[] = [];
      const deleteAccount = createTool({
        id: 'deleteAccount',
        description: 'Delete an account',
        inputSchema: z.object({ action: z.string() }),
        requireApproval: true,
        execute: async (_input, context) => {
          executedFor.push(userIdOf(context.requestContext));
          return { deleted: true };
        },
      });
      const agent = new Agent({
        id: 'resume-admin-approval-agent',
        name: 'Resume Admin Approval Agent',
        instructions: 'Delete the account once approved',
        model: createSuspendingThenTextModel('deleteAccount', ['Deleted']),
        // Only admins get the tool.
        tools: ({ requestContext }) => (roleOf(requestContext) === 'admin' ? { deleteAccount } : {}),
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const initial = await durable.stream('Delete it', {
          closeOnSuspend: true,
          requestContext: signedIn('alice', 'admin'),
        });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        expect((await durable.listSuspendedRuns()).runs[0]?.toolCalls).toEqual([
          expect.objectContaining({ toolCallId: 'call-1', toolName: 'deleteAccount', requiresApproval: true }),
        ]);
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = { runId: initial.runId, toolCallId: 'call-1', closeOnSuspend: true };

        await expect(
          durable.resume(initial.runId, { approved: true }, { ...options, requestContext: signedIn('guest') }),
        ).rejects.toMatchObject({ id: 'AGENT_RESUME_TOOL_UNAVAILABLE' });
        expect(executedFor).toEqual([]);
        expect((await durable.listSuspendedRuns()).runs[0]?.toolCalls).toEqual([
          expect.objectContaining({ toolCallId: 'call-1', toolName: 'deleteAccount', requiresApproval: true }),
        ]);

        const resumed = await (
          await durable.resume(
            initial.runId,
            { approved: true },
            { ...options, requestContext: signedIn('bob', 'admin') },
          )
        ).output.getFullOutput();
        expect(resumed.error).toBeUndefined();
        expect(resumed.text).toBe('Deleted');
        expect(executedFor).toEqual(['bob']);
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );

  // Technical: relying on workflow `suspendedAt`/`resumedAt` timestamps collides when a tool
  // resumes and suspends again within the same millisecond (e.g. phase 2 -> phase 3). Stamping
  // a fresh `suspensionId` on each durable suspension keeps every re-suspension distinct even
  // under a stationary clock.
  it.each(['explicit', 'unlabeled'] as const)(
    'a stale %s cold resume cannot answer a later re-suspension even within the same millisecond',
    async mode => {
      const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
      const answered: Array<{ phase: number | undefined; confirmed: boolean }> = [];
      const preparing = deferred();
      const mayFinish = deferred();
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({ phase: z.number() }),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ phase: 1 });
          const phase = context.agent.suspendPayload?.phase;
          answered.push({ phase, confirmed: context.agent.resumeData.confirmed });
          if (phase && phase < 3) return context.agent.suspend({ phase: phase + 1 });
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const makeAgent = (toolCallIds: string[]) =>
        new Agent({
          id: 'resume-same-ms-agent',
          name: 'Resume Same MS Agent',
          instructions: 'Ask for confirmation',
          model: createToolCallSequenceModel('ask', toolCallIds, 'Confirmed'),
          tools: async ({ requestContext }) => {
            if (requestContext.get('tenant') === 'slow-caller') {
              preparing.resolve();
              await mayFinish.promise;
            }
            return { ask };
          },
        });
      const storage = new InMemoryStore();
      const pubsub = new EventEmitterPubSub();
      const otherPubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent: makeAgent(['call-1']), pubsub });
      const host = new Mastra({ agents: { durable }, storage, logger: false });
      const otherDurable = new AgentClass({ agent: makeAgent([]), pubsub: otherPubsub });
      const otherHost = new Mastra({ agents: { durable: otherDurable }, storage, logger: false });
      try {
        const initial = await durable.stream('Confirm', { closeOnSuspend: true });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;

        // Move to phase 2 first so both compared suspensions already have resumedAt at the same ms.
        const phaseTwo = await (
          await otherDurable.resume(initial.runId, { confirmed: true }, { runId: initial.runId, closeOnSuspend: true })
        ).output.getFullOutput();
        expect(phaseTwo.error).toBeUndefined();
        otherDurable.runRegistry.clear();
        durable.runRegistry.clear();
        globalRunRegistry.delete(initial.runId);

        const slow = durable
          .resume(
            initial.runId,
            { confirmed: false },
            {
              runId: initial.runId,
              toolCallId: mode === 'explicit' ? 'call-1' : undefined,
              closeOnSuspend: true,
              requestContext: new RequestContext([['tenant', 'slow-caller']]),
            },
          )
          .then(
            result => result.output.getFullOutput(),
            (error: unknown) => error,
          );
        await preparing.promise;

        const phaseThree = await (
          await otherDurable.resume(initial.runId, { confirmed: true }, { runId: initial.runId, closeOnSuspend: true })
        ).output.getFullOutput();
        expect(phaseThree.error).toBeUndefined();
        expect(answered).toEqual([
          { phase: 1, confirmed: true },
          { phase: 2, confirmed: true },
        ]);

        mayFinish.resolve();
        await expect(slow).resolves.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
        expect(answered).toEqual([
          { phase: 1, confirmed: true },
          { phase: 2, confirmed: true },
        ]);
        expect((await durable.listSuspendedRuns()).runs[0]?.toolCalls).toContainEqual(
          expect.objectContaining({ toolCallId: 'call-1', suspendPayload: { phase: 3 } }),
        );
      } finally {
        clock.mockRestore();
        mayFinish.resolve();
        await host.shutdown({ drainTimeout: 1000 });
        await otherHost.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
        await otherPubsub.close();
      }
    },
  );
});
