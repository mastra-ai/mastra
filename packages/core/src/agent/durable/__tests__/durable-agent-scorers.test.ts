import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createScorer } from '../../../evals';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// DurableAgent Scorer Tests
// ============================================================================

describe('DurableAgent Scorers', () => {
  let pubsub: EventEmitterPubSub;
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();

    mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('scorer configuration serialization', () => {
    it('should serialize scorers config in workflow input', async () => {
      const testScorer = createScorer({
        id: 'test-scorer',
        name: 'testScorer',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          testScorer: {
            scorer: testScorer,
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeDefined();
      expect(result.workflowInput.scorers).toHaveProperty('testScorer');
      expect(result.workflowInput.scorers!.testScorer!.scorerName).toBe('testScorer');
    });

    it('should serialize scorer sampling config', async () => {
      const testScorer = createScorer({
        id: 'test-scorer',
        name: 'testScorer',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          testScorer: {
            scorer: testScorer,
            sampling: { type: 'ratio', rate: 0.5 },
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeDefined();
      expect(result.workflowInput.scorers!.testScorer!.sampling).toEqual({
        type: 'ratio',
        rate: 0.5,
      });
    });

    it('should not include scorers in workflow input when not configured', async () => {
      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeUndefined();
    });
  });

  describe('scorer execution', () => {
    it('should allow override scorers in execution options', async () => {
      const defaultScorer = createScorer({
        id: 'default-scorer',
        name: 'defaultScorer',
        description: 'Default Scorer',
      }).generateScore(() => 0.8);

      const overrideScorer = createScorer({
        id: 'override-scorer',
        name: 'overrideScorer',
        description: 'Override Scorer',
      }).generateScore(() => 0.9);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          defaultScorer: {
            scorer: defaultScorer,
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // Override scorers in execution options
      const result = await durableAgent.prepare('Hello', {
        scorers: {
          overrideScorer: {
            scorer: overrideScorer,
          },
        },
      } as any);

      // Override should replace default scorers
      expect(result.workflowInput.scorers).toBeDefined();
      expect(result.workflowInput.scorers).toHaveProperty('overrideScorer');
      expect(result.workflowInput.scorers).not.toHaveProperty('defaultScorer');
    });
  });

  describe('scorer name resolution', () => {
    it('should serialize scorer by name for runtime resolution', async () => {
      const testScorer = createScorer({
        id: 'test-scorer',
        name: 'testScorer',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          myScorer: {
            scorer: testScorer,
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      // The scorer config should contain the name, not the object
      expect(result.workflowInput.scorers!.myScorer!.scorerName).toBe('testScorer');
    });

    it('should support multiple scorers', async () => {
      const scorer1 = createScorer({
        id: 'scorer-1',
        name: 'scorer1',
        description: 'First Scorer',
      }).generateScore(() => 0.8);

      const scorer2 = createScorer({
        id: 'scorer-2',
        name: 'scorer2',
        description: 'Second Scorer',
      }).generateScore(() => 0.9);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          first: { scorer: scorer1 },
          second: { scorer: scorer2, sampling: { type: 'none' } },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeDefined();
      expect(Object.keys(result.workflowInput.scorers!)).toHaveLength(2);
      expect(result.workflowInput.scorers!.first!.scorerName).toBe('scorer1');
      expect(result.workflowInput.scorers!.second!.scorerName).toBe('scorer2');
      expect(result.workflowInput.scorers!.second!.sampling).toEqual({ type: 'none' });
    });
  });

  describe('returnScorerData option', () => {
    it('should serialize returnScorerData option in workflow input', async () => {
      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        returnScorerData: true,
      } as any);

      expect(result.workflowInput.options.returnScorerData).toBe(true);
    });

    it('should default returnScorerData to undefined when not specified', async () => {
      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.options.returnScorerData).toBeUndefined();
    });
  });
});
