import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * Creates a mock model that returns a simple text response.
 */
function createSimpleMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text: 'Hello! I am responding.' }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'response-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello! I am responding.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

/**
 * Tests for RequestContext memory isolation - Issue #11651
 *
 * The bug: When agents share a RequestContext, the MastraMemory context (including
 * memoryConfig.readOnly) could be polluted by other agents using the same context.
 *
 * The fix: Remove the early readOnly check from getOutputProcessors(). The readOnly
 * flag is now only checked at execution time in each processor's processOutputResult
 * method, allowing proper isolation when agents share a RequestContext.
 */
describe('RequestContext memory isolation - Issue #11651', () => {
  /**
   * This test verifies that an agent's readOnly setting is respected even when
   * the RequestContext already has MastraMemory set from a parent context.
   *
   * Scenario: Parent agent set readOnly: true, but child agent wants readOnly: false
   * Expected: Child agent should be able to save messages (its readOnly: false should win)
   */
  it('should respect child agent readOnly:false when RequestContext has parent readOnly:true', async () => {
    const threadId = randomUUID();
    const resourceId = 'test-user';
    const mockMemory = new MockMemory();

    await mockMemory.createThread({ threadId, resourceId });

    const agent = new Agent({
      id: 'child-agent',
      name: 'Child Agent',
      instructions: 'You are a child agent that should write to memory.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Simulate a parent's RequestContext that already has MastraMemory with readOnly: true
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: 'parent-thread-id' },
      resourceId: 'parent-resource',
      memoryConfig: { readOnly: true }, // Parent had readOnly: true
    });

    // Child agent calls stream with readOnly: false
    // The fix ensures the child's setting is respected, not the parent's
    const response = await agent.stream('Hello!', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          readOnly: false, // Child wants to write
        },
      },
      requestContext,
    });

    await response.consumeStream();

    // Verify messages were saved - child's readOnly: false should be respected
    const result = await mockMemory.recall({ threadId, resourceId });
    expect(result.messages.length).toBeGreaterThan(0);
  });

  /**
   * Control test: Verify readOnly: true still works correctly
   */
  it('should NOT save messages when agent has readOnly:true regardless of parent context', async () => {
    const threadId = randomUUID();
    const resourceId = 'test-user';
    const mockMemory = new MockMemory();

    await mockMemory.createThread({ threadId, resourceId });

    const agent = new Agent({
      id: 'readonly-agent',
      name: 'ReadOnly Agent',
      instructions: 'You are a read-only agent.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Parent context has readOnly: false, but agent wants readOnly: true
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: 'parent-thread-id' },
      resourceId: 'parent-resource',
      memoryConfig: { readOnly: false }, // Parent had readOnly: false
    });

    // Agent calls stream with readOnly: true
    const response = await agent.stream('Hello!', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          readOnly: true, // Agent wants read-only
        },
      },
      requestContext,
    });

    await response.consumeStream();

    // Verify NO messages were saved - agent's readOnly: true should be respected
    const result = await mockMemory.recall({ threadId, resourceId });
    expect(result.messages.length).toBe(0);
  });

  /**
   * Test that two agents can have different readOnly settings with the same RequestContext
   */
  it('should allow different readOnly settings for sequential agent calls with shared RequestContext', async () => {
    const thread1Id = randomUUID();
    const thread2Id = randomUUID();
    const resourceId = 'test-user';
    const mockMemory = new MockMemory();

    await mockMemory.createThread({ threadId: thread1Id, resourceId });
    await mockMemory.createThread({ threadId: thread2Id, resourceId });

    const agent1 = new Agent({
      id: 'agent-1',
      name: 'Agent 1',
      instructions: 'You are agent 1.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    const agent2 = new Agent({
      id: 'agent-2',
      name: 'Agent 2',
      instructions: 'You are agent 2.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Shared RequestContext between both agents
    const sharedRequestContext = new RequestContext();

    // Agent 1: readOnly: true (should NOT save)
    const response1 = await agent1.stream('Hello from agent 1!', {
      memory: {
        thread: thread1Id,
        resource: resourceId,
        options: { readOnly: true },
      },
      requestContext: sharedRequestContext,
    });
    await response1.consumeStream();

    // Agent 2: readOnly: false (SHOULD save)
    // Even though agent 1 set MastraMemory with readOnly: true,
    // agent 2's setting should be respected
    const response2 = await agent2.stream('Hello from agent 2!', {
      memory: {
        thread: thread2Id,
        resource: resourceId,
        options: { readOnly: false },
      },
      requestContext: sharedRequestContext,
    });
    await response2.consumeStream();

    // Verify agent 1's thread has NO messages (readOnly: true)
    const result1 = await mockMemory.recall({ threadId: thread1Id, resourceId });
    expect(result1.messages.length).toBe(0);

    // Verify agent 2's thread HAS messages (readOnly: false)
    const result2 = await mockMemory.recall({ threadId: thread2Id, resourceId });
    expect(result2.messages.length).toBeGreaterThan(0);
  });
});
