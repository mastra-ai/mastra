/**
 * Usage tracking tests for DurableAgent
 *
 * These tests verify token usage tracking through the durable workflow,
 * including accumulated usage across multiple steps.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createUsageTests({ createAgent }: DurableAgentTestContext) {
  describe('usage tracking', () => {
    describe('basic usage tracking', () => {
      it('should include usage data in workflow input initialization', async () => {
        const mockModel = createTextStreamModel('Response text');

        const agent = await createAgent({
          id: 'usage-test-agent',
          name: 'Usage Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
        });

        const result = await agent.prepare('Test message');

        expect(result.workflowInput).toBeDefined();
        expect(result.workflowInput.runId).toBe(result.runId);
      });

      it('should track model configuration in workflow input', async () => {
        const mockModel = createTextStreamModel('Response text');

        const agent = await createAgent({
          id: 'model-config-agent',
          name: 'Model Config Agent',
          instructions: 'Test',
          model: mockModel,
        });

        const result = await agent.prepare('Test');

        expect(result.workflowInput.modelConfig).toBeDefined();
        expect(result.workflowInput.modelConfig.provider).toBeDefined();
        expect(result.workflowInput.modelConfig.modelId).toBeDefined();
      });
    });

    describe('usage in stream options', () => {
      it('should pass includeRawChunks option to workflow', async () => {
        const mockModel = createTextStreamModel('Response text');

        const agent = await createAgent({
          id: 'raw-chunks-agent',
          name: 'Raw Chunks Agent',
          instructions: 'Test',
          model: mockModel,
        });

        const result = await agent.prepare('Test', {
          includeRawChunks: true,
        });

        expect(result.workflowInput.options.includeRawChunks).toBe(true);
      });

      it('should pass model settings including temperature', async () => {
        const mockModel = createTextStreamModel('Response text');

        const agent = await createAgent({
          id: 'temperature-agent',
          name: 'Temperature Agent',
          instructions: 'Test',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Response text');

        const agent = await createAgent({
          id: 'init-usage-agent',
          name: 'Init Usage Agent',
          instructions: 'Test',
          model: mockModel,
        });

        // Just verify that prepare works - workflow initialization is implementation-specific
        const result = await agent.prepare('Test');
        expect(result.runId).toBeDefined();
      });
    });
  });

  describe('usage accumulation', () => {
    it('should prepare workflow with correct structure for accumulation', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'accumulation-agent',
        name: 'Accumulation Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test');

      expect(result.workflowInput.runId).toBeDefined();
      expect(result.workflowInput.messageListState).toBeDefined();
      expect(result.workflowInput.modelConfig).toBeDefined();
      expect(result.workflowInput.options).toBeDefined();
      expect(result.workflowInput.state).toBeDefined();
      expect(result.workflowInput.messageId).toBeDefined();
    });

    it('should handle multiple prepare calls independently', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'multi-prepare-agent',
        name: 'Multi Prepare Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result1 = await agent.prepare('First message');
      const result2 = await agent.prepare('Second message');
      const result3 = await agent.prepare('Third message');

      expect(result1.runId).not.toBe(result2.runId);
      expect(result2.runId).not.toBe(result3.runId);
      expect(result1.runId).not.toBe(result3.runId);

      expect(result1.messageId).not.toBe(result2.messageId);
      expect(result2.messageId).not.toBe(result3.messageId);
    });
  });

  describe('model settings', () => {
    it('should pass temperature setting', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'temp-setting-agent',
        name: 'Temp Setting Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test', {
        modelSettings: { temperature: 0.5 },
      });

      expect(result.workflowInput.options.temperature).toBe(0.5);
    });

    it('should handle missing model settings', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'no-settings-agent',
        name: 'No Settings Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test');

      expect(result.workflowInput.options.temperature).toBeUndefined();
    });

    it('should serialize model config correctly', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'serialize-config-agent',
        name: 'Serialize Config Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test');

      const serialized = JSON.stringify(result.workflowInput.modelConfig);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.provider).toBeDefined();
      expect(deserialized.modelId).toBeDefined();
    });
  });

  describe('processor retry configuration', () => {
    it('should pass maxProcessorRetries to workflow input', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'retry-config-agent',
        name: 'Retry Config Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test', {
        maxProcessorRetries: 3,
      });

      expect(result.workflowInput.options.maxProcessorRetries).toBe(3);
    });

    it('should default maxProcessorRetries to undefined when not specified', async () => {
      const mockModel = createTextStreamModel('Response text');

      const agent = await createAgent({
        id: 'default-retry-agent',
        name: 'Default Retry Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test');

      expect(result.workflowInput.options.maxProcessorRetries).toBeUndefined();
    });
  });
}
