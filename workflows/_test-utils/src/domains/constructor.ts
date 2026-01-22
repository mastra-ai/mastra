/**
 * Constructor tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel } from '../mock-models';

export function createConstructorTests({ getPubSub }: DurableAgentTestContext) {
  describe('constructor', () => {
    it('should create a DurableAgent with required config', () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      // id and name are available synchronously from config
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.runRegistry).toBeDefined();

      // agent getter throws before initialization
      expect(() => agent.agent).toThrow('DurableAgent not initialized');
    });

    it('should provide agent instance after async initialization', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const durableAgent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      // After calling prepare (async), agent should be available
      await durableAgent.prepare('Hello');
      expect(durableAgent.agent).toBeDefined();
      expect(durableAgent.agent.id).toBe('test-agent');
    });

    it('should use agent id as name when name is not provided', () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'my-agent-id',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      expect(agent.name).toBe('my-agent-id');
    });
  });
}
