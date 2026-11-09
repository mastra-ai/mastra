/**
 * DurableAgent tool suspension: workflow input serialization.
 *
 * Runtime suspension behavior (suspend/resume, auto-resume, snapshots, readOnly
 * flush) is covered on every engine by the aimock scenarios in
 * src/loop/test-utils/aimock/scenarios/. These tests only cover how
 * DurableAgent.prepare() serializes suspension-related options and memory
 * context into the workflow input.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns a tool call
 */
function createToolCallModel(toolName: string, toolArgs: object) {
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

describe('DurableAgent tool suspension workflow input', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should support autoResumeSuspendedTools option', async () => {
    const mockModel = createToolCallModel('autoResumeTool', { value: 'test' });

    const autoResumeTool = createTool({
      id: 'autoResumeTool',
      description: 'A tool that auto-resumes',
      inputSchema: z.object({ value: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ input: z.string() }),
      execute: async () => ({ result: 'auto-resumed' }),
    });

    const baseAgent = new Agent({
      id: 'auto-resume-agent',
      name: 'Auto Resume Agent',
      instructions: 'Use auto-resuming tools',
      model: mockModel as LanguageModelV2,
      tools: { autoResumeTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test auto resume', {
      autoResumeSuspendedTools: true,
    });

    expect(result.workflowInput.options.autoResumeSuspendedTools).toBe(true);
  });

  it('should preserve memory context through suspension', async () => {
    const mockModel = createToolCallModel('memoryTool', { query: 'test' });

    const memoryTool = createTool({
      id: 'memoryTool',
      description: 'A tool that uses memory',
      inputSchema: z.object({ query: z.string() }),
      suspendSchema: z.object({ pendingQuery: z.string() }),
      resumeSchema: z.object({ additionalInfo: z.string() }),
      execute: async () => ({ found: true }),
    });

    const baseAgent = new Agent({
      id: 'memory-suspension-agent',
      name: 'Memory Suspension Agent',
      instructions: 'Use memory with suspension',
      model: mockModel as LanguageModelV2,
      tools: { memoryTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Search with memory', {
      memory: {
        thread: 'thread-suspension-test',
        resource: 'user-456',
      },
    });

    expect(result.threadId).toBe('thread-suspension-test');
    expect(result.resourceId).toBe('user-456');
    expect(result.workflowInput.state.threadId).toBe('thread-suspension-test');
    expect(result.workflowInput.state.resourceId).toBe('user-456');
  });

  it('should include suspension-related options in workflow input', async () => {
    const mockModel = createToolCallModel('statefulTool', { action: 'start' });

    const statefulTool = createTool({
      id: 'statefulTool',
      description: 'A stateful tool',
      inputSchema: z.object({ action: z.string() }),
      suspendSchema: z.object({ state: z.string() }),
      resumeSchema: z.object({ newState: z.string() }),
      execute: async () => ({ state: 'completed' }),
    });

    const baseAgent = new Agent({
      id: 'stateful-agent',
      name: 'Stateful Agent',
      instructions: 'Manage state',
      model: mockModel as LanguageModelV2,
      tools: { statefulTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Start stateful operation', {
      autoResumeSuspendedTools: false,
      maxSteps: 10,
    });

    expect(result.workflowInput.options.maxSteps).toBe(10);
    expect(result.workflowInput.options.autoResumeSuspendedTools).toBe(false);
  });
});
