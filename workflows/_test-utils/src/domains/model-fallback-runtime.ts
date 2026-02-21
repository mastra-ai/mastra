/**
 * Model fallback runtime behavior tests for DurableAgent
 *
 * Tests for actual fallback behavior during execution.
 * These tests are DurableAgent-only because they require mock model
 * instances in the registry (not serializable for Inngest).
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createFailingChunkModel, createFlakyModel } from '../mock-models';

export function createModelFallbackRuntimeTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;

  describe('model fallback runtime behavior', () => {
    it('should fall back to second model when primary fails', async () => {
      const primary = createFailingChunkModel('Primary model failed');
      const fallback = createTextStreamModel('Fallback response');

      const agent = await createAgent({
        id: 'fallback-runtime-agent',
        instructions: 'Test',
        model: [
          { id: 'primary', model: primary },
          { id: 'fallback', model: fallback },
        ],
      });

      let text = '';
      const { cleanup } = await agent.stream('Test message', {
        onChunk: (chunk: any) => {
          if (chunk.type === 'text-delta') {
            text += chunk.payload?.text || '';
          }
        },
      });

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay + 1500));
      cleanup();

      expect(text).toBe('Fallback response');
    }, 10000);

    it('should retry model before falling back', async () => {
      // Flaky model fails 2 times then succeeds (matches maxRetries: 2)
      const flaky = createFlakyModel(2, 'Success after retries');
      const fallback = createTextStreamModel('Fallback');

      const agent = await createAgent({
        id: 'retry-before-fallback-agent',
        instructions: 'Test',
        model: [
          { id: 'primary', model: flaky, maxRetries: 2 },
          { id: 'fallback', model: fallback },
        ],
      });

      let text = '';
      const { cleanup } = await agent.stream('Test message', {
        onChunk: (chunk: any) => {
          if (chunk.type === 'text-delta') {
            text += chunk.payload?.text || '';
          }
        },
      });

      // Wait for retries and streaming
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay + 4500));
      cleanup();

      // Should succeed with primary after retries, not use fallback
      expect(text).toBe('Success after retries');
    }, 15000);

    it('should skip disabled models in execution', async () => {
      const enabled = createTextStreamModel('Enabled model response');
      const disabled = createFailingChunkModel('Should not be called');

      let disabledModelCalled = false;
      const disabledWithTracking = {
        ...disabled,
        doStream: async () => {
          disabledModelCalled = true;
          return (disabled as any).doStream();
        },
      };

      const agent = await createAgent({
        id: 'skip-disabled-agent',
        instructions: 'Test',
        model: [
          { id: 'disabled', model: disabledWithTracking, enabled: false },
          { id: 'enabled', model: enabled, enabled: true },
        ],
      });

      let text = '';
      const { cleanup } = await agent.stream('Test message', {
        onChunk: (chunk: any) => {
          if (chunk.type === 'text-delta') {
            text += chunk.payload?.text || '';
          }
        },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay + 1000));
      cleanup();

      expect(disabledModelCalled).toBe(false);
      expect(text).toBe('Enabled model response');
    }, 10000);

    it('should fall back after exhausting retries on first model', async () => {
      // Flaky model fails 5 times (more than maxRetries: 2 allows)
      const flaky = createFlakyModel(5, 'Should not reach');
      const fallback = createTextStreamModel('Fallback used');

      const agent = await createAgent({
        id: 'exhaust-retries-agent',
        instructions: 'Test',
        model: [
          { id: 'primary', model: flaky, maxRetries: 2 },
          { id: 'fallback', model: fallback },
        ],
      });

      let text = '';
      const { cleanup } = await agent.stream('Test message', {
        onChunk: (chunk: any) => {
          if (chunk.type === 'text-delta') {
            text += chunk.payload?.text || '';
          }
        },
      });

      // Wait for retries and fallback
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay + 7500));
      cleanup();

      // Should use fallback after exhausting retries on primary
      expect(text).toBe('Fallback used');
    }, 20000);

    // TODO: This test has timing issues in the shared suite - passes in core tests
    // The error callback isn't being received within the timeout window
    it.skip('should invoke onError when all models are exhausted', async () => {
      const failing1 = createFailingChunkModel('First model failed');
      const failing2 = createFailingChunkModel('Second model failed');

      const agent = await createAgent({
        id: 'all-exhausted-agent',
        instructions: 'Test',
        model: [
          { id: 'first', model: failing1, maxRetries: 0 },
          { id: 'second', model: failing2, maxRetries: 0 },
        ],
      });

      let errorReceived = false;
      const { cleanup } = await agent.stream('Test message', {
        onError: () => {
          errorReceived = true;
        },
      });

      // Wait for both models to fail and error to propagate
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay + 2000));
      cleanup();

      expect(errorReceived).toBe(true);
    }, 15000);
  });
}
