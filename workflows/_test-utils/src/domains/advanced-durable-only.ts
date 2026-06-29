/**
 * DurableAgent-specific advanced tests
 *
 * These tests cover features specific to DurableAgent that are not available
 * in InngestDurableAgent:
 * - runRegistry access (getModel, getTools, has, cleanup)
 * - Wrapped agent access
 * - Concurrent operations with registry
 * - MessageList serialization/deserialization
 *
 * These tests should NOT be run with InngestDurableAgent.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Agent, MessageList } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createAdvancedDurableOnlyTests({ getPubSub }: DurableAgentTestContext) {
  describe('run registry access', () => {
    it('should store model in registry for runtime access', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const innerAgent = new Agent({
        id: 'model-registry-agent',
        name: 'Model Registry Agent',
        instructions: 'Test',
        model: mockModel,
      });
      const agent = createDurableAgent({ agent: innerAgent, pubsub });

      const result = await agent.prepare('Test');

      const storedModel = agent.runRegistry.getModel(result.runId);
      expect(storedModel).toBeDefined();
      expect(storedModel?.modelId).toBe('mock-model-id');
      expect(storedModel?.provider).toBe('mock-provider');
    });

    it('should handle multiple concurrent prepare calls', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const innerAgent = new Agent({
        id: 'concurrent-agent',
        name: 'Concurrent Agent',
        instructions: 'Test',
        model: mockModel,
      });
      const agent = createDurableAgent({ agent: innerAgent, pubsub });

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

      const innerAgent = new Agent({
        id: 'isolation-agent',
        name: 'Isolation Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { tool1 },
      });
      const agent = createDurableAgent({ agent: innerAgent, pubsub });

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

  describe('wrapped agent access', () => {
    it('should provide access to wrapped agent', () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const innerAgent = new Agent({
        id: 'wrapped-agent-test',
        name: 'Wrapped Agent Test',
        instructions: 'Test',
        model: mockModel,
      });
      const agent = createDurableAgent({ agent: innerAgent, pubsub });

      expect(agent.id).toBe('wrapped-agent-test');
      expect(agent.name).toBe('Wrapped Agent Test');
      expect(agent.runRegistry).toBeDefined();
      expect(agent.agent).toBe(innerAgent);
    });

    it('should handle multiple concurrent prepare calls', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const innerAgent = new Agent({
        id: 'concurrent-prepare-agent',
        name: 'Concurrent Prepare Agent',
        instructions: 'Test',
        model: mockModel,
      });
      const agent = createDurableAgent({ agent: innerAgent, pubsub });

      const results = await Promise.all([agent.prepare('Test 1'), agent.prepare('Test 2'), agent.prepare('Test 3')]);

      expect(results.length).toBe(3);
      expect(new Set(results.map(r => r.runId)).size).toBe(3);
    });
  });

  describe('MessageList serialization', () => {
    it('should handle MessageList serialization and deserialization', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const innerAgent = new Agent({
        id: 'messagelist-agent',
        name: 'MessageList Agent',
        instructions: 'Test instructions',
        model: mockModel,
      });
      const agent = createDurableAgent({ agent: innerAgent, pubsub });

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
