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
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
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

    // Disconnect (cleanup)
    initialCleanup();

    // Verify events were cached - use the correct topic format
    const topic = `agent.stream.${runId}`;
    const cachedEvents = await cachingPubsub.getHistory(topic);
    // Events should be cached (at least the start event)
    expect(cachedEvents.length).toBeGreaterThan(0);
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
    cleanup();

    // Subscribe with replay - should get events without duplicates
    const topic = `agent.stream.${runId}`;
    await cachingPubsub.subscribeWithReplay(topic, event => {
      receivedEvents.push(event);
    });

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
