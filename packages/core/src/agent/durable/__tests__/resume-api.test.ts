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
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

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

async function seedSuspendedRun(
  store: InMemoryStore,
  runId: string,
  agentId: string,
  memory: { threadId: string; resourceId: string },
  status: WorkflowRunState['status'] = 'suspended',
) {
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
          messageListState: { memoryInfo: memory },
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

      await expect(durableAgent.resume(runId, { approved: true })).rejects.toThrow(
        'This workflow run was not suspended',
      );
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

    it('forwards storage-backed approval options into the durable resume path', async () => {
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
            toolCalls: [{ toolCallId, requiresApproval: true }],
          },
        ],
        total: 1,
      });

      const result = await durableAgent.sendToolApproval({
        threadId: memory.thread,
        resourceId: memory.resource,
        toolCallId,
        approved: true,
        memory,
      });

      expect(listSuspendedRunsSpy).toHaveBeenCalledWith({
        threadId: memory.thread,
        resourceId: memory.resource,
      });
      expect(result).toEqual({ accepted: true, runId, toolCallId });
      expect(resumeSpy).toHaveBeenCalledWith(runId, { approved: true }, expect.objectContaining({ memory }));
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
    expect(durableAgent.runRegistry.has(runId)).toBe(false);
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
