/**
 * DurableAgent-specific advanced tests
 *
 * These tests cover features specific to DurableAgent that are not available
 * in InngestDurableAgent:
 * - runRegistry access (getModel, getTools, has, cleanup)
 * - Lazy initialization (agent accessor)
 * - Concurrent operations with registry
 * - MessageList serialization/deserialization
 *
 * These tests should NOT be run with InngestDurableAgent.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import { MessageList } from '@mastra/core/agent';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createAdvancedDurableOnlyTests({ getPubSub }: DurableAgentTestContext) {
  describe('run registry access', () => {
    it('should store model in registry for runtime access', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'model-registry-agent',
        name: 'Model Registry Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Test');

      const storedModel = agent.runRegistry.getModel(result.runId);
      expect(storedModel).toBeDefined();
      expect(storedModel?.modelId).toBe('mock-model-id');
      expect(storedModel?.provider).toBe('mock-provider');
    });

    it('should handle multiple concurrent prepare calls', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'concurrent-agent',
        name: 'Concurrent Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const preparePromises = Array.from({ length: 10 }, (_, i) => agent.prepare(`Message ${i}`));

      const results = await Promise.all(preparePromises);

      const runIds = results.map(r => r.runId);
      expect(new Set(runIds).size).toBe(10);

      for (const result of results) {
        expect(agent.runRegistry.has(result.runId)).toBe(true);
      }
    });

    it('should isolate registry entries between runs', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const tool1 = createTool({
        id: 'tool1',
        description: 'Tool 1',
        inputSchema: z.object({ x: z.number() }),
        execute: async ({ x }) => x * 2,
      });

      const agent = new DurableAgent({
        id: 'isolation-agent',
        name: 'Isolation Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { tool1 },
        pubsub,
      });

      const result1 = await agent.prepare('First');
      const result2 = await agent.prepare('Second');

      const tools1 = agent.runRegistry.getTools(result1.runId);
      const tools2 = agent.runRegistry.getTools(result2.runId);

      expect(tools1.tool1).toBeDefined();
      expect(tools2.tool1).toBeDefined();

      agent.runRegistry.cleanup(result1.runId);
      expect(agent.runRegistry.has(result1.runId)).toBe(false);
      expect(agent.runRegistry.has(result2.runId)).toBe(true);
      expect(agent.runRegistry.getTools(result2.runId).tool1).toBeDefined();
    });
  });

  describe('lazy initialization', () => {
    it('should not initialize Agent until first async method call', () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'lazy-init-agent',
        name: 'Lazy Init Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      expect(agent.id).toBe('lazy-init-agent');
      expect(agent.name).toBe('Lazy Init Agent');
      expect(agent.runRegistry).toBeDefined();

      expect(() => agent.agent).toThrow('DurableAgent not initialized');
    });

    it('should initialize Agent after prepare call', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'init-after-prepare-agent',
        name: 'Init After Prepare Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      expect(() => agent.agent).toThrow();

      await agent.prepare('Test');
      expect(agent.agent).toBeDefined();
      expect(agent.agent.id).toBe('init-after-prepare-agent');
    });

    it('should initialize Agent after stream call', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'init-after-stream-agent',
        name: 'Init After Stream Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      expect(() => agent.agent).toThrow();

      const { cleanup } = await agent.stream('Test');
      expect(agent.agent).toBeDefined();
      cleanup();
    });

    it('should only initialize once even with multiple concurrent calls', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'single-init-agent',
        name: 'Single Init Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const results = await Promise.all([agent.prepare('Test 1'), agent.prepare('Test 2'), agent.prepare('Test 3')]);

      expect(results.length).toBe(3);
      expect(new Set(results.map(r => r.runId)).size).toBe(3);

      expect(agent.agent).toBeDefined();
    });
  });

  describe('MessageList serialization', () => {
    it('should handle MessageList serialization and deserialization', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'messagelist-agent',
        name: 'MessageList Agent',
        instructions: 'Test instructions',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare([
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Follow-up' },
      ]);

      const serialized = JSON.stringify(result.workflowInput.messageListState);
      const deserialized = JSON.parse(serialized);

      const newMessageList = new MessageList({});
      newMessageList.deserialize(deserialized);

      const messages = newMessageList.get.all.db();
      expect(messages.length).toBeGreaterThan(0);
    });
  });
}
