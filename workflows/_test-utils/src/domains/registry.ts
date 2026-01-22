/**
 * Registry tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent, RunRegistry, ExtendedRunRegistry } from '@mastra/core/agent/durable';
import { MessageList } from '@mastra/core/agent';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel } from '../mock-models';

export function createRegistryTests({ getPubSub }: DurableAgentTestContext) {
  describe('runRegistry', () => {
    it('should track active runs', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      // Initially empty
      expect(agent.runRegistry.size).toBe(0);

      // After prepare, should have one entry
      const result = await agent.prepare('Hello!');
      expect(agent.runRegistry.size).toBe(1);
      expect(agent.runRegistry.has(result.runId)).toBe(true);

      // After cleanup, should be empty again
      agent.runRegistry.cleanup(result.runId);
      expect(agent.runRegistry.size).toBe(0);
    });

    it('should track multiple concurrent runs', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      // Create multiple runs
      const result1 = await agent.prepare('First message');
      const result2 = await agent.prepare('Second message');
      const result3 = await agent.prepare('Third message');

      expect(agent.runRegistry.size).toBe(3);
      expect(agent.runRegistry.has(result1.runId)).toBe(true);
      expect(agent.runRegistry.has(result2.runId)).toBe(true);
      expect(agent.runRegistry.has(result3.runId)).toBe(true);

      // Cleanup one
      agent.runRegistry.cleanup(result2.runId);
      expect(agent.runRegistry.size).toBe(2);
      expect(agent.runRegistry.has(result2.runId)).toBe(false);
    });
  });

  describe('RunRegistry', () => {
    it('should store and retrieve tools', () => {
      const registry = new RunRegistry();
      const runId = 'test-run-789';
      const tools = {
        testTool: {
          description: 'A test tool',
          parameters: { type: 'object' },
          execute: async () => 'result',
        },
      };
      const mockModel = { provider: 'test', modelId: 'test-model' } as any;

      registry.register(runId, {
        tools,
        saveQueueManager: undefined as any,
        model: mockModel,
      });

      expect(registry.has(runId)).toBe(true);
      expect(registry.getTools(runId)).toBe(tools);
      expect(registry.getModel(runId)).toBe(mockModel);

      registry.cleanup(runId);
      expect(registry.has(runId)).toBe(false);
    });

    it('should handle multiple runs', () => {
      const registry = new RunRegistry();
      const mockModel = { provider: 'test', modelId: 'test-model' } as any;

      registry.register('run-1', { tools: { a: {} } as any, saveQueueManager: undefined as any, model: mockModel });
      registry.register('run-2', { tools: { b: {} } as any, saveQueueManager: undefined as any, model: mockModel });
      registry.register('run-3', { tools: { c: {} } as any, saveQueueManager: undefined as any, model: mockModel });

      expect(registry.size).toBe(3);
      expect(registry.runIds).toContain('run-1');
      expect(registry.runIds).toContain('run-2');
      expect(registry.runIds).toContain('run-3');

      registry.clear();
      expect(registry.size).toBe(0);
    });

    it('should replace existing entry on re-register', () => {
      const registry = new RunRegistry();
      const mockModel = { provider: 'test', modelId: 'test-model' } as any;
      const runId = 'test-run';

      const tools1 = { tool1: { description: 'First' } } as any;
      const tools2 = { tool2: { description: 'Second' } } as any;

      registry.register(runId, { tools: tools1, saveQueueManager: undefined as any, model: mockModel });
      expect(registry.getTools(runId)).toBe(tools1);

      registry.register(runId, { tools: tools2, saveQueueManager: undefined as any, model: mockModel });
      expect(registry.getTools(runId)).toBe(tools2);
      expect(registry.size).toBe(1);
    });
  });

  describe('ExtendedRunRegistry', () => {
    it('should store and retrieve memory info', () => {
      const registry = new ExtendedRunRegistry();
      const runId = 'test-run-extended';
      const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
      const mockModel = { provider: 'test', modelId: 'test-model' } as any;

      registry.registerWithMessageList(
        runId,
        { tools: {}, saveQueueManager: undefined as any, model: mockModel },
        messageList,
        {
          threadId: 'thread-1',
          resourceId: 'user-1',
        },
      );

      expect(registry.has(runId)).toBe(true);
      expect(registry.getMessageList(runId)).toBe(messageList);
      expect(registry.getMemoryInfo(runId)).toEqual({ threadId: 'thread-1', resourceId: 'user-1' });
      expect(registry.getModel(runId)).toBe(mockModel);

      registry.cleanup(runId);
      expect(registry.has(runId)).toBe(false);
      expect(registry.getMessageList(runId)).toBeUndefined();
      expect(registry.getMemoryInfo(runId)).toBeUndefined();
    });

    it('should inherit all RunRegistry functionality', () => {
      const registry = new ExtendedRunRegistry();
      const mockModel = { provider: 'test', modelId: 'test-model' } as any;

      // Can use basic register
      registry.register('basic-run', { tools: { t: {} } as any, saveQueueManager: undefined as any, model: mockModel });
      expect(registry.has('basic-run')).toBe(true);
      expect(registry.getTools('basic-run')).toBeDefined();

      // Can use extended register
      const messageList = new MessageList({});
      registry.registerWithMessageList(
        'extended-run',
        { tools: {}, saveQueueManager: undefined as any, model: mockModel },
        messageList,
        { threadId: 't1' },
      );

      expect(registry.size).toBe(2);
      expect(registry.getMessageList('extended-run')).toBe(messageList);
      expect(registry.getMemoryInfo('extended-run')?.threadId).toBe('t1');

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
}
