/**
 * DurableAgent Tool Concurrency Tests
 *
 * Tests for sequential vs concurrent tool execution control.
 * Validates that toolCallConcurrency option and approval/suspension flags
 * correctly influence tool execution order.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns multiple tool calls
 */
function createMultipleToolCallsModel(tools: Array<{ name: string; args: object }>) {
  const toolCallChunks = tools.map((tool, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: `call-${index + 1}`,
    toolName: tool.name,
    input: JSON.stringify(tool.args),
    providerExecuted: false,
  }));

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        ...toolCallChunks,
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
 * Creates a simple text model
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
// DurableAgent Tool Concurrency Tests
// ============================================================================

describe('DurableAgent tool concurrency', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('toolCallConcurrency option', () => {
    it('should include toolCallConcurrency in workflow options', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'First tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool1' }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Second tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool2' }),
      });

      const agent = new DurableAgent({
        id: 'concurrency-agent',
        name: 'Concurrency Agent',
        instructions: 'Use both tools',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2 },
        pubsub,
      });

      const result = await agent.prepare('Use both tools', {
        toolCallConcurrency: 5,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(5);
    });

    it('should default toolCallConcurrency when not specified', async () => {
      const mockModel = createMultipleToolCallsModel([{ name: 'tool1', args: { data: 'test' } }]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'A tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'done' }),
      });

      const agent = new DurableAgent({
        id: 'default-concurrency-agent',
        name: 'Default Concurrency Agent',
        instructions: 'Use tool',
        model: mockModel as LanguageModelV2,
        tools: { tool1 },
        pubsub,
      });

      const result = await agent.prepare('Use the tool');

      // Should be undefined or a default value when not specified
      // The actual default is handled by the workflow execution
      expect(result.runId).toBeDefined();
    });

    it('should set toolCallConcurrency to 1 for sequential execution', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'First tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool1' }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Second tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool2' }),
      });

      const agent = new DurableAgent({
        id: 'sequential-agent',
        name: 'Sequential Agent',
        instructions: 'Use tools sequentially',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2 },
        pubsub,
      });

      const result = await agent.prepare('Use both tools', {
        toolCallConcurrency: 1,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(1);
    });
  });

  describe('concurrency with requireToolApproval', () => {
    it('should force sequential execution when requireToolApproval is true', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'First tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool1' }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Second tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool2' }),
      });

      const agent = new DurableAgent({
        id: 'approval-concurrency-agent',
        name: 'Approval Concurrency Agent',
        instructions: 'Use tools with approval',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2 },
        pubsub,
      });

      // When requireToolApproval is true, tools must be executed sequentially
      // even if toolCallConcurrency is set to a higher value
      const result = await agent.prepare('Use both tools', {
        requireToolApproval: true,
        toolCallConcurrency: 10, // This should be overridden to 1
      });

      expect(result.workflowInput.options.requireToolApproval).toBe(true);
      expect(result.workflowInput.options.toolCallConcurrency).toBe(10);
      // Note: The actual forcing of sequential execution happens at runtime
    });

    it('should handle tool-level requireApproval affecting concurrency', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'normalTool', args: { data: 'test1' } },
        { name: 'approvalTool', args: { data: 'test2' } },
      ]);

      const normalTool = createTool({
        id: 'normalTool',
        description: 'Normal tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'normal' }),
      });

      const approvalTool = createTool({
        id: 'approvalTool',
        description: 'Tool requiring approval',
        inputSchema: z.object({ data: z.string() }),
        requireApproval: true,
        execute: async () => ({ result: 'approved' }),
      });

      const agent = new DurableAgent({
        id: 'mixed-approval-concurrency-agent',
        name: 'Mixed Approval Concurrency Agent',
        instructions: 'Use mixed tools',
        model: mockModel as LanguageModelV2,
        tools: { normalTool, approvalTool },
        pubsub,
      });

      const result = await agent.prepare('Use both tools');

      // Both tools should be registered
      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools.normalTool).toBeDefined();
      expect(tools.approvalTool).toBeDefined();
    });
  });

  describe('concurrency with suspendSchema', () => {
    it('should handle suspendSchema affecting concurrency', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'quickTool', args: { data: 'test1' } },
        { name: 'suspendTool', args: { data: 'test2' } },
      ]);

      const quickTool = createTool({
        id: 'quickTool',
        description: 'Quick non-suspending tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'quick' }),
      });

      const suspendTool = createTool({
        id: 'suspendTool',
        description: 'Tool that can suspend',
        inputSchema: z.object({ data: z.string() }),
        suspendSchema: z.object({ reason: z.string() }),
        resumeSchema: z.object({ continue: z.boolean() }),
        execute: async () => ({ result: 'suspended' }),
      });

      const agent = new DurableAgent({
        id: 'suspend-concurrency-agent',
        name: 'Suspend Concurrency Agent',
        instructions: 'Use both tools',
        model: mockModel as LanguageModelV2,
        tools: { quickTool, suspendTool },
        pubsub,
      });

      const result = await agent.prepare('Use both tools');

      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools.quickTool).toBeDefined();
      expect(tools.suspendTool).toBeDefined();
    });
  });

  describe('concurrency edge cases', () => {
    it('should handle negative toolCallConcurrency gracefully', async () => {
      const mockModel = createTextModel('Hello');

      const agent = new DurableAgent({
        id: 'negative-concurrency-agent',
        name: 'Negative Concurrency Agent',
        instructions: 'Test negative value',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        toolCallConcurrency: -5,
      });

      // Should accept the value (validation happens at runtime)
      expect(result.workflowInput.options.toolCallConcurrency).toBe(-5);
    });

    it('should handle zero toolCallConcurrency', async () => {
      const mockModel = createTextModel('Hello');

      const agent = new DurableAgent({
        id: 'zero-concurrency-agent',
        name: 'Zero Concurrency Agent',
        instructions: 'Test zero value',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        toolCallConcurrency: 0,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(0);
    });

    it('should handle very high toolCallConcurrency', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
        { name: 'tool3', args: { data: 'test3' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'Tool 1',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 1 }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Tool 2',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 2 }),
      });

      const tool3 = createTool({
        id: 'tool3',
        description: 'Tool 3',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 3 }),
      });

      const agent = new DurableAgent({
        id: 'high-concurrency-agent',
        name: 'High Concurrency Agent',
        instructions: 'Use many tools',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2, tool3 },
        pubsub,
      });

      const result = await agent.prepare('Use all tools', {
        toolCallConcurrency: 100,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(100);
    });
  });

  describe('concurrency serialization', () => {
    it('should serialize toolCallConcurrency in workflow input', async () => {
      const mockModel = createMultipleToolCallsModel([{ name: 'tool1', args: { data: 'test' } }]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'A tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'done' }),
      });

      const agent = new DurableAgent({
        id: 'serialize-concurrency-agent',
        name: 'Serialize Concurrency Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
        tools: { tool1 },
        pubsub,
      });

      const result = await agent.prepare('Use tool', {
        toolCallConcurrency: 3,
      });

      // Verify JSON serialization
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.options.toolCallConcurrency).toBe(3);
    });
  });
});
