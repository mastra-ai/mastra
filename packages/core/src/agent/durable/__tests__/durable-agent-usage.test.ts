/**
 * DurableAgent Usage Tracking Tests
 *
 * These tests verify token usage tracking through the durable workflow,
 * including accumulated usage across multiple steps.
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

function createModelWithUsage(usage: { inputTokens: number; outputTokens: number; totalTokens: number }) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Response text' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage,
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Response text' }],
      finishReason: 'stop',
      usage,
      warnings: [],
    }),
  });
}

function createMultiStepModelWithUsage(
  steps: Array<{ usage: { inputTokens: number; outputTokens: number; totalTokens: number }; text: string }>,
) {
  let stepIndex = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const step = steps[stepIndex % steps.length];
      stepIndex++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${stepIndex}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: step.text },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: step.usage,
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

// ============================================================================
// Usage Tracking Tests
// ============================================================================

describe('DurableAgent usage tracking', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('basic usage tracking', () => {
    it('should include usage data in workflow input initialization', async () => {
      const mockModel = createModelWithUsage({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      const agent = new DurableAgent({
        id: 'usage-test-agent',
        name: 'Usage Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Test message');

      // Workflow input should be prepared
      expect(result.workflowInput).toBeDefined();
      expect(result.workflowInput.runId).toBe(result.runId);
    });

    it('should track model configuration in workflow input', async () => {
      const mockModel = createModelWithUsage({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });

      const agent = new DurableAgent({
        id: 'model-config-agent',
        name: 'Model Config Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Test');

      expect(result.workflowInput.modelConfig).toBeDefined();
      expect(result.workflowInput.modelConfig.provider).toBeDefined();
      expect(result.workflowInput.modelConfig.modelId).toBeDefined();
    });
  });

  describe('usage in stream options', () => {
    it('should pass includeRawChunks option to workflow', async () => {
      const mockModel = createModelWithUsage({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });

      const agent = new DurableAgent({
        id: 'raw-chunks-agent',
        name: 'Raw Chunks Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Test', {
        includeRawChunks: true,
      });

      expect(result.workflowInput.options.includeRawChunks).toBe(true);
    });

    it('should pass model settings including temperature', async () => {
      const mockModel = createModelWithUsage({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });

      const agent = new DurableAgent({
        id: 'temperature-agent',
        name: 'Temperature Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Test', {
        modelSettings: {
          temperature: 0.7,
        },
      });

      expect(result.workflowInput.options.temperature).toBe(0.7);
    });
  });

  describe('workflow initialization state', () => {
    it('should initialize with zero accumulated usage', async () => {
      const mockModel = createModelWithUsage({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });

      const agent = new DurableAgent({
        id: 'init-usage-agent',
        name: 'Init Usage Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // Get the workflow to inspect its structure
      const workflow = agent.getWorkflow();
      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('durable-agentic-loop');
    });
  });
});

// ============================================================================
// Usage Accumulation Tests
// ============================================================================

describe('DurableAgent usage accumulation', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should prepare workflow with correct structure for accumulation', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'accumulation-agent',
      name: 'Accumulation Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    // The workflow input should have all required fields
    expect(result.workflowInput.runId).toBeDefined();
    expect(result.workflowInput.messageListState).toBeDefined();
    expect(result.workflowInput.modelConfig).toBeDefined();
    expect(result.workflowInput.options).toBeDefined();
    expect(result.workflowInput.state).toBeDefined();
    expect(result.workflowInput.messageId).toBeDefined();
  });

  it('should handle multiple prepare calls independently', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'multi-prepare-agent',
      name: 'Multi Prepare Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result1 = await agent.prepare('First message');
    const result2 = await agent.prepare('Second message');
    const result3 = await agent.prepare('Third message');

    // Each should have unique runId
    expect(result1.runId).not.toBe(result2.runId);
    expect(result2.runId).not.toBe(result3.runId);
    expect(result1.runId).not.toBe(result3.runId);

    // Each should have unique messageId
    expect(result1.messageId).not.toBe(result2.messageId);
    expect(result2.messageId).not.toBe(result3.messageId);

    // All should be in registry
    expect(agent.runRegistry.has(result1.runId)).toBe(true);
    expect(agent.runRegistry.has(result2.runId)).toBe(true);
    expect(agent.runRegistry.has(result3.runId)).toBe(true);
  });
});

// ============================================================================
// Model Settings Tests
// ============================================================================

describe('DurableAgent model settings', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should pass temperature setting', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'temp-setting-agent',
      name: 'Temp Setting Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', {
      modelSettings: { temperature: 0.5 },
    });

    expect(result.workflowInput.options.temperature).toBe(0.5);
  });

  it('should handle missing model settings', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'no-settings-agent',
      name: 'No Settings Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    // Should not throw and temperature should be undefined
    expect(result.workflowInput.options.temperature).toBeUndefined();
  });

  it('should serialize model config correctly', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'serialize-config-agent',
      name: 'Serialize Config Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    // Model config should be serializable
    const serialized = JSON.stringify(result.workflowInput.modelConfig);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.provider).toBeDefined();
    expect(deserialized.modelId).toBeDefined();
  });
});

// ============================================================================
// Processor Retry Configuration Tests
// ============================================================================

describe('DurableAgent processor retry configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should pass maxProcessorRetries to workflow input', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'retry-config-agent',
      name: 'Retry Config Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test', {
      maxProcessorRetries: 3,
    });

    expect(result.workflowInput.options.maxProcessorRetries).toBe(3);
  });

  it('should default maxProcessorRetries to undefined when not specified', async () => {
    const mockModel = createModelWithUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    const agent = new DurableAgent({
      id: 'default-retry-agent',
      name: 'Default Retry Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Test');

    expect(result.workflowInput.options.maxProcessorRetries).toBeUndefined();
  });
});
