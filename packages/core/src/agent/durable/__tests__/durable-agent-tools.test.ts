/**
 * DurableAgent tool preparation internals.
 *
 * End-to-end tool behavior (execution, errors, multi-tool, toolChoice, approval,
 * maxSteps) is covered by the aimock scenarios in
 * `src/loop/test-utils/aimock/scenarios/`, which run on every engine including
 * durable. These tests pin what prepare() writes into the run registry and the
 * serialized workflow input.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import '../constants';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import '../types';

// ============================================================================
// Tool Registration Tests
// ============================================================================

describe('DurableAgent tool registration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle tools with complex input schemas', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const complexTool = createTool({
      id: 'complex',
      description: 'A tool with complex input',
      inputSchema: z.object({
        name: z.string(),
        age: z.number().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z
          .object({
            key: z.string(),
            value: z.unknown(),
          })
          .optional(),
      }),
      execute: async input => ({ received: input }),
    });

    const baseAgent = new Agent({
      id: 'complex-tool-agent',
      name: 'Complex Tool Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { complex: complexTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test');

    const tools = durableAgent.runRegistry.getTools(result.runId);
    const execResult = await tools.complex.execute!(
      {
        name: 'test',
        age: 25,
        tags: ['a', 'b'],
        metadata: { key: 'foo', value: 123 },
      },
      {} as any,
    );

    expect(execResult).toEqual({
      received: {
        name: 'test',
        age: 25,
        tags: ['a', 'b'],
        metadata: { key: 'foo', value: 123 },
      },
    });
  });
});

// ============================================================================
// Tool Metadata Serialization Tests
// ============================================================================

describe('DurableAgent tool metadata serialization', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should serialize tool metadata without execute functions', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const testTool = createTool({
      id: 'test-tool',
      description: 'Test tool description',
      inputSchema: z.object({
        param1: z.string().describe('First parameter'),
        param2: z.number().optional().describe('Second parameter'),
      }),
      execute: async ({ param1, param2 }) => `${param1}-${param2}`,
    });

    const baseAgent = new Agent({
      id: 'serialization-agent',
      name: 'Serialization Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { testTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test');

    // Serialize and deserialize to verify no functions
    const serialized = JSON.stringify(result.workflowInput);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.toolsMetadata).toBeDefined();
    // Tools metadata should be an array (can be serialized)
    expect(Array.isArray(deserialized.toolsMetadata)).toBe(true);
  });

  it('should preserve tool descriptions in metadata', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const describedTool = createTool({
      id: 'described-tool',
      description: 'This is a detailed description of what this tool does',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => input,
    });

    const baseAgent = new Agent({
      id: 'description-agent',
      name: 'Description Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      tools: { describedTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test');

    // The tools in registry should have description
    const tools = durableAgent.runRegistry.getTools(result.runId);
    expect(tools.describedTool.description).toBe('This is a detailed description of what this tool does');
  });
});

// ============================================================================
// Workflow Input Option Serialization Tests
// ============================================================================

describe('DurableAgent workflow input options', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should pass toolCallConcurrency to workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const baseAgent = new Agent({
      id: 'concurrency-agent',
      name: 'Concurrency Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test', { toolCallConcurrency: 5 });

    expect(result.workflowInput.options.toolCallConcurrency).toBe(5);
  });

  // In-process engines read the approval policy from the run registry, so this
  // serialized copy is only exercised by cross-process engines (e.g. Inngest).
  it('should serialize toolChoice and requireToolApproval into workflow input', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const baseAgent = new Agent({
      id: 'options-agent',
      name: 'Options Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    for (const toolChoice of ['auto', 'none', 'required'] as const) {
      const result = await durableAgent.prepare('Test', { toolChoice });
      expect(result.workflowInput.options.toolChoice).toBe(toolChoice);
    }

    const approvalResult = await durableAgent.prepare('Test', { requireToolApproval: true });
    expect(approvalResult.workflowInput.options.requireToolApproval).toBe(true);

    const policyResult = await durableAgent.prepare('Test', { requireToolApproval: () => false });
    expect(policyResult.workflowInput.options.requireToolApproval).toBe(true);
  });
});
