import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// DurableAgent Model Fallback Tests
// ============================================================================

describe('DurableAgent Model Fallback', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  /**
   * Helper to create a mock model that succeeds
   */
  function createSuccessModel(text: string = 'Hello from model') {
    return new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  }

  /**
   * Helper to create a mock model that fails
   * The model returns a stream that emits an error chunk (similar to real LLM failures)
   */
  function createFailingModel() {
    return new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'error', error: new Error('Model execution failed') },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  }

  /**
   * Helper to create a mock model that fails N times then succeeds
   */
  function createFlakyModel(failCount: number, successText: string = 'Success after retries') {
    let attempts = 0;
    return new MockLanguageModelV2({
      doStream: async () => {
        attempts++;
        if (attempts <= failCount) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: successText },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });
  }

  describe('model list in prepare', () => {
    it('should serialize model list in workflow input', async () => {
      const model1 = createSuccessModel('Model 1 response');
      const model2 = createSuccessModel('Model 2 response');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { model: model1 as LanguageModelV2, maxRetries: 2 },
          { model: model2 as LanguageModelV2, maxRetries: 1 },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.modelList).toBeDefined();
      expect(result.workflowInput.modelList).toHaveLength(2);
      expect(result.workflowInput.modelList![0]!.maxRetries).toBe(2);
      expect(result.workflowInput.modelList![1]!.maxRetries).toBe(1);
    });

    it('should serialize primary model config even without model list', async () => {
      const model = createSuccessModel('Single model response');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: model as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.modelConfig).toBeDefined();
      expect(result.workflowInput.modelConfig.provider).toBe('mock-provider');
      expect(result.workflowInput.modelConfig.modelId).toBe('mock-model-id');
      // No modelList when using single model
      expect(result.workflowInput.modelList).toBeUndefined();
    });
  });

  describe('model list filtering', () => {
    it('should filter disabled models in workflow input', async () => {
      const model1 = createSuccessModel('Model 1 response');
      const model2 = createSuccessModel('Model 2 response');
      const model3 = createSuccessModel('Model 3 response');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { model: model1 as LanguageModelV2, enabled: false },
          { model: model2 as LanguageModelV2, enabled: true },
          { model: model3 as LanguageModelV2 }, // enabled by default
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      // Disabled models are filtered out at serialization time
      expect(result.workflowInput.modelList).toBeDefined();
      expect(result.workflowInput.modelList).toHaveLength(2);
      // Only enabled models (model2 and model3) should be in the list
      expect(result.workflowInput.modelList![0]!.enabled).toBe(true);
      expect(result.workflowInput.modelList![1]!.enabled).toBe(true);
    });

    it('should preserve maxRetries in model list', async () => {
      const model1 = createSuccessModel('Model 1');
      const model2 = createSuccessModel('Model 2');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { model: model1 as LanguageModelV2, maxRetries: 5 },
          { model: model2 as LanguageModelV2, maxRetries: 0 },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.modelList![0]!.maxRetries).toBe(5);
      expect(result.workflowInput.modelList![1]!.maxRetries).toBe(0);
    });

    it('should generate unique IDs for each model entry', async () => {
      const model1 = createSuccessModel('Model 1');
      const model2 = createSuccessModel('Model 2');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [{ model: model1 as LanguageModelV2 }, { model: model2 as LanguageModelV2 }],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.modelList![0]!.id).toBeDefined();
      expect(result.workflowInput.modelList![1]!.id).toBeDefined();
      // IDs should be unique
      expect(result.workflowInput.modelList![0]!.id).not.toBe(result.workflowInput.modelList![1]!.id);
    });
  });

  describe('runtime behavior', () => {
    it('should fall back to second model when primary fails', async () => {
      const failingModel = createFailingModel();
      const successModel = createSuccessModel('Fallback response');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { id: 'primary', model: failingModel as LanguageModelV2, maxRetries: 0 },
          { id: 'fallback', model: successModel as LanguageModelV2, maxRetries: 0 },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      let text = '';
      const { cleanup } = await durableAgent.stream('Hello', {
        onChunk: chunk => {
          if (chunk.type === 'text-delta') {
            text += (chunk.payload as any).text;
          }
        },
      });

      // Wait for streaming to complete (need more time for fallback)
      await new Promise(resolve => setTimeout(resolve, 2000));
      cleanup();

      expect(text).toBe('Fallback response');
    }, 10000);

    it('should retry model before falling back', async () => {
      // Model that fails 2 times then succeeds (needs maxRetries: 2)
      const flakyModel = createFlakyModel(2, 'Success after retries');
      const fallbackModel = createSuccessModel('Fallback response');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { id: 'primary', model: flakyModel as LanguageModelV2, maxRetries: 2 },
          { id: 'fallback', model: fallbackModel as LanguageModelV2, maxRetries: 0 },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      let text = '';
      const { cleanup } = await durableAgent.stream('Hello', {
        onChunk: chunk => {
          if (chunk.type === 'text-delta') {
            text += (chunk.payload as any).text;
          }
        },
      });

      // Wait for streaming to complete (with retries, needs more time)
      await new Promise(resolve => setTimeout(resolve, 5000));
      cleanup();

      // Should get success from flaky model after retries, not fallback
      expect(text).toBe('Success after retries');
    }, 10000); // Longer timeout for retry delays

    it('should skip disabled models', async () => {
      let disabledModelCalled = false;
      const disabledModel = new MockLanguageModelV2({
        doStream: async () => {
          disabledModelCalled = true;
          throw new Error('Disabled model should not be called');
        },
      });
      const enabledModel = createSuccessModel('Enabled model response');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { id: 'disabled', model: disabledModel as LanguageModelV2, enabled: false },
          { id: 'enabled', model: enabledModel as LanguageModelV2, enabled: true },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      let text = '';
      const { cleanup } = await durableAgent.stream('Hello', {
        onChunk: chunk => {
          if (chunk.type === 'text-delta') {
            text += (chunk.payload as any).text;
          }
        },
      });

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      cleanup();

      expect(disabledModelCalled).toBe(false);
      expect(text).toBe('Enabled model response');
    });

    it('should invoke onError callback when all models are exhausted', async () => {
      const failingModel1 = createFailingModel();
      const failingModel2 = createFailingModel();

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { id: 'model1', model: failingModel1 as LanguageModelV2, maxRetries: 0 },
          { id: 'model2', model: failingModel2 as LanguageModelV2, maxRetries: 0 },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      let errorReceived: Error | null = null;
      const { cleanup } = await durableAgent.stream('Hello', {
        onError: error => {
          errorReceived = error;
        },
      });

      // Wait for error to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      cleanup();

      expect(errorReceived).not.toBeNull();
      expect(errorReceived!.message).toContain('Model execution failed');
    });

    it('should fall back after exhausting retries on first model', async () => {
      // Model that always fails (more failures than retries allow)
      const flakyModel = createFlakyModel(5, 'Should not reach');
      const fallbackModel = createSuccessModel('Fallback used');

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: [
          { id: 'primary', model: flakyModel as LanguageModelV2, maxRetries: 2 }, // Will fail after 3 attempts
          { id: 'fallback', model: fallbackModel as LanguageModelV2, maxRetries: 0 },
        ],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      let text = '';
      const { cleanup } = await durableAgent.stream('Hello', {
        onChunk: chunk => {
          if (chunk.type === 'text-delta') {
            text += (chunk.payload as any).text;
          }
        },
      });

      // Wait for streaming to complete (with retries, needs more time)
      await new Promise(resolve => setTimeout(resolve, 8000));
      cleanup();

      // Should fall back after exhausting retries on flaky model
      expect(text).toBe('Fallback used');
    }, 15000); // Longer timeout for retry delays
  });
});
