/**
 * Model fallback configuration tests for DurableAgent
 *
 * Tests for model list configuration and serialization.
 * These tests run on both DurableAgent and Inngest since they focus on
 * configuration/serialization, not runtime behavior.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createModelFallbackTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('model fallback configuration', () => {
    it('should accept model list configuration', async () => {
      const primary = createTextStreamModel('Primary');
      const fallback = createTextStreamModel('Fallback');

      const agent = await createAgent({
        id: 'model-list-agent',
        instructions: 'Test',
        model: [
          { id: 'primary', model: primary, maxRetries: 1 },
          { id: 'fallback', model: fallback },
        ],
      });

      const result = await agent.prepare('Test');
      expect(result.workflowInput.modelList).toBeDefined();
      expect(result.workflowInput.modelList).toHaveLength(2);
    });

    it('should serialize model list config in workflow input', async () => {
      const primary = createTextStreamModel('Primary');
      const fallback = createTextStreamModel('Fallback');

      const agent = await createAgent({
        id: 'serialize-agent',
        instructions: 'Test',
        model: [
          { id: 'primary', model: primary, maxRetries: 2 },
          { id: 'fallback', model: fallback },
        ],
      });

      const result = await agent.prepare('Test');

      // Workflow input should be JSON-serializable (for durable execution)
      const serialized = JSON.stringify(result.workflowInput);
      expect(() => JSON.parse(serialized)).not.toThrow();

      // Model list entries should include config
      expect(result.workflowInput.modelList[0].id).toBe('primary');
      expect(result.workflowInput.modelList[0].maxRetries).toBe(2);
      expect(result.workflowInput.modelList[0].config).toBeDefined();
      expect(result.workflowInput.modelList[0].config.modelId).toBeDefined();
    });

    it('should filter disabled models from workflow input', async () => {
      const enabled = createTextStreamModel('Enabled');
      const disabled = createTextStreamModel('Disabled');
      const alsoEnabled = createTextStreamModel('Also Enabled');

      const agent = await createAgent({
        id: 'disabled-filter-agent',
        instructions: 'Test',
        model: [
          { id: 'enabled', model: enabled, enabled: true },
          { id: 'disabled', model: disabled, enabled: false },
          { id: 'also-enabled', model: alsoEnabled },
        ],
      });

      const result = await agent.prepare('Test');

      // Only enabled models should be in the list
      expect(result.workflowInput.modelList).toHaveLength(2);
      expect(result.workflowInput.modelList.map((m: any) => m.id)).toEqual(['enabled', 'also-enabled']);
    });

    it('should generate unique IDs for models without explicit ID', async () => {
      const primary = createTextStreamModel('Primary');
      const fallback = createTextStreamModel('Fallback');

      const agent = await createAgent({
        id: 'auto-id-agent',
        instructions: 'Test',
        model: [{ model: primary }, { model: fallback }],
      });

      const result = await agent.prepare('Test');

      // Each model should have a generated ID
      expect(result.workflowInput.modelList[0].id).toBeDefined();
      expect(result.workflowInput.modelList[1].id).toBeDefined();
      expect(result.workflowInput.modelList[0].id).not.toBe(result.workflowInput.modelList[1].id);
    });

    it('should preserve maxRetries configuration', async () => {
      const model1 = createTextStreamModel('Model 1');
      const model2 = createTextStreamModel('Model 2');
      const model3 = createTextStreamModel('Model 3');

      const agent = await createAgent({
        id: 'retries-agent',
        instructions: 'Test',
        model: [
          { id: 'high-retries', model: model1, maxRetries: 5 },
          { id: 'low-retries', model: model2, maxRetries: 1 },
          { id: 'no-retries', model: model3, maxRetries: 0 },
        ],
      });

      const result = await agent.prepare('Test');

      expect(result.workflowInput.modelList[0].maxRetries).toBe(5);
      expect(result.workflowInput.modelList[1].maxRetries).toBe(1);
      expect(result.workflowInput.modelList[2].maxRetries).toBe(0);
    });

    it('should use primary model config for modelConfig (first in list)', async () => {
      const primary = createTextStreamModel('Primary');
      const fallback = createTextStreamModel('Fallback');

      const agent = await createAgent({
        id: 'primary-config-agent',
        instructions: 'Test',
        model: [
          { id: 'primary', model: primary },
          { id: 'fallback', model: fallback },
        ],
      });

      const result = await agent.prepare('Test');

      // modelConfig should match the first model in the list
      expect(result.workflowInput.modelConfig.modelId).toBe(result.workflowInput.modelList[0].config.modelId);
    });
  });
}
