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

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
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

      await expect(durableAgent.resume('missing-cold-run', { approved: true })).rejects.toThrow(
        'No registry entry found for run missing-cold-run. Cannot resume.',
      );
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
          await emitFinishEvent(cachingPubsub, runId, {
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
          await emitChunkEvent(cachingPubsub, runId, {
            type: 'text-delta',
            runId,
            from: 'AGENT',
            payload: { id: 'observed-text', text: 'Live observer answer' },
          });
          await emitFinishEvent(cachingPubsub, runId, {
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
        await emitFinishEvent(cachingPubsub, runId, {
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
describe.each([DurableAgent, EventedAgent])('resume schema preflight (%#)', AgentClass => {
  it.each(
    ['warm', 'cold'].flatMap(registry =>
      (['resumeStream', 'resumeGenerate', 'resume'] as const).flatMap(method =>
        ['assigned', 'toolset'].map(source => ({ registry, method, source })),
      ),
    ),
  )(
    'allows correcting invalid data via $method with a $registry registry and $source tool',
    async ({ registry, method, source }) => {
      const resumedValues: boolean[] = [];
      const ask = createTool({
        id: 'ask',
        description: 'Ask for confirmation',
        inputSchema: z.object({ action: z.string() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ confirmed: z.boolean() }).transform(data => ({ ...data, validated: true })),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({});
          resumedValues.push(context.agent.resumeData.confirmed);
          return { confirmed: context.agent.resumeData.confirmed };
        },
      });
      const agent = new Agent({
        id: 'resume-schema-agent',
        name: 'Resume Schema Agent',
        instructions: 'Ask for confirmation',
        model: createSuspendingThenTextModel('ask', ['Confirmed']),
        tools: source === 'assigned' ? { ask } : {},
      });
      const pubsub = new EventEmitterPubSub();
      const durable = new AgentClass({ agent, pubsub });
      const host = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
      try {
        const toolOptions = source === 'toolset' ? { toolsets: { extra: { ask } } } : {};
        const initial = await durable.stream('Confirm', { closeOnSuspend: true, ...toolOptions });
        await drain(initial.output.fullStream);
        await globalRunRegistry.get(initial.runId)?.workflowExecution;
        expect((await durable.listSuspendedRuns()).runs).toHaveLength(1);
        if (registry === 'cold') {
          durable.runRegistry.clear();
          globalRunRegistry.delete(initial.runId);
        }
        const options = {
          ...toolOptions,
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
        expect(resumedValues).toEqual([true]);
        expect(resumed.toolResults.map(chunk => chunk.payload.result)).toContainEqual({ confirmed: true });
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        await pubsub.close();
      }
    },
  );
});
