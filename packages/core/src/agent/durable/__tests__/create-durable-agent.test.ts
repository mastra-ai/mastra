/**
 * Tests for createDurableAgent factory function
 *
 * These tests verify the factory function that wraps a regular Agent
 * with CachingPubSub for resumable streams.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent, isLocalDurableAgent } from '../create-durable-agent';

// Mock model for testing
function createMockModel() {
  return {
    provider: 'test',
    modelId: 'test-model',
    specificationVersion: 'v1',
    supportsStructuredOutputs: true,
    doGenerate: vi.fn(),
    doStream: vi.fn().mockImplementation(async () => {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'Hello ' });
            controller.enqueue({ type: 'text-delta', textDelta: 'World!' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 5 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: '', rawSettings: {} },
      };
    }),
  };
}

describe('createDurableAgent factory', () => {
  let agent: Agent<any, any, any>;

  beforeEach(() => {
    agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: createMockModel() as any,
    });
  });

  describe('basic creation', () => {
    it('should create a LocalDurableAgent from a regular Agent', () => {
      const durableAgent = createDurableAgent({ agent });

      expect(durableAgent.id).toBe('test-agent');
      expect(durableAgent.name).toBe('Test Agent');
      expect(durableAgent.agent).toBe(agent);
      expect(typeof durableAgent.stream).toBe('function');
      expect(typeof durableAgent.resume).toBe('function');
      expect(typeof durableAgent.prepare).toBe('function');
      expect(typeof durableAgent.getDurableWorkflows).toBe('function');
    });

    it('should allow id/name override', () => {
      const durableAgent = createDurableAgent({
        agent,
        id: 'custom-id',
        name: 'Custom Name',
      });

      expect(durableAgent.id).toBe('custom-id');
      expect(durableAgent.name).toBe('Custom Name');
    });

    it('should pass isLocalDurableAgent type guard', () => {
      const durableAgent = createDurableAgent({ agent });

      expect(isLocalDurableAgent(durableAgent)).toBe(true);
    });

    it('should fail isLocalDurableAgent for regular agent', () => {
      expect(isLocalDurableAgent(agent)).toBe(false);
      expect(isLocalDurableAgent(null)).toBe(false);
      expect(isLocalDurableAgent({})).toBe(false);
    });
  });

  describe('cache configuration', () => {
    it('should use InMemoryServerCache by default', () => {
      const durableAgent = createDurableAgent({ agent });

      expect(durableAgent.cache).toBeInstanceOf(InMemoryServerCache);
    });

    it('should accept custom cache', () => {
      const customCache = new InMemoryServerCache();
      const durableAgent = createDurableAgent({ agent, cache: customCache });

      expect(durableAgent.cache).toBe(customCache);
    });

    it('should wrap pubsub with CachingPubSub', () => {
      const durableAgent = createDurableAgent({ agent });

      expect(durableAgent.pubsub).toBeInstanceOf(CachingPubSub);
    });

    it('should use custom pubsub wrapped with CachingPubSub', () => {
      const customPubsub = new EventEmitterPubSub();
      const durableAgent = createDurableAgent({ agent, pubsub: customPubsub });

      expect(durableAgent.pubsub).toBeInstanceOf(CachingPubSub);
      // The inner pubsub should be our custom one
      expect((durableAgent.pubsub as CachingPubSub).getInner()).toBe(customPubsub);
    });
  });

  describe('proxy behavior', () => {
    it('should forward method calls to underlying agent', () => {
      const durableAgent = createDurableAgent({ agent });

      // The 'in' operator should work for both durableAgent and agent properties
      expect('id' in durableAgent).toBe(true);
      expect('stream' in durableAgent).toBe(true);
      expect('agent' in durableAgent).toBe(true);
    });

    it('should have access to underlying agent via agent property', () => {
      const durableAgent = createDurableAgent({ agent });

      // Can access the wrapped agent
      expect(durableAgent.agent).toBe(agent);
      expect(durableAgent.agent.id).toBe('test-agent');
    });
  });

  describe('getDurableWorkflows', () => {
    it('should return array with one workflow', () => {
      const durableAgent = createDurableAgent({ agent });
      const workflows = durableAgent.getDurableWorkflows();

      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBe(1);
    });
  });

  describe('__registerMastra', () => {
    it('should accept mastra instance', () => {
      const durableAgent = createDurableAgent({ agent });
      const mockMastra = { id: 'test-mastra' } as any;

      // Should not throw
      expect(() => durableAgent.__registerMastra(mockMastra)).not.toThrow();
    });
  });
});
