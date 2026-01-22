/**
 * Prepare tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel } from '../mock-models';

export function createPrepareTests({ getPubSub }: DurableAgentTestContext) {
  describe('prepare', () => {
    it('should prepare workflow input without starting execution', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Hello!');

      expect(result.runId).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.workflowInput).toBeDefined();
      expect(result.workflowInput.runId).toBe(result.runId);
      expect(result.workflowInput.agentId).toBe('test-agent');
      expect(result.workflowInput.messageListState).toBeDefined();
      expect(result.workflowInput.modelConfig).toBeDefined();
      expect(result.workflowInput.options).toBeDefined();

      // Verify entry was registered
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should accept string messages', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Hello, world!');

      expect(result.workflowInput.messageListState).toBeDefined();
      // Verify messages were added to message list
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should accept array of string messages', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare(['First message', 'Second message']);

      expect(result.workflowInput.messageListState).toBeDefined();
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should accept message objects', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare([
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]);

      expect(result.workflowInput.messageListState).toBeDefined();
      expect(agent.runRegistry.has(result.runId)).toBe(true);
    });

    it('should serialize tool metadata correctly', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        tools: {
          greet: {
            description: 'Greet a user',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
              required: ['name'],
            },
            execute: async ({ name }: { name: string }) => `Hello, ${name}!`,
          },
        },
        pubsub,
      });

      const result = await agent.prepare('Say hello to Alice');

      // Check that tool metadata is serialized
      expect(result.workflowInput.toolsMetadata).toBeDefined();
      expect(result.workflowInput.toolsMetadata.length).toBeGreaterThanOrEqual(0);

      // Verify tools are stored in registry (with execute functions)
      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools).toBeDefined();
    });

    it('should handle memory options', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Hello!', {
        memory: {
          thread: 'thread-123',
          resource: 'user-456',
        },
      });

      expect(result.threadId).toBe('thread-123');
      expect(result.resourceId).toBe('user-456');
      expect(result.workflowInput.state.threadId).toBe('thread-123');
      expect(result.workflowInput.state.resourceId).toBe('user-456');
    });

    it('should store model in registry', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Hello!');

      // Model should be stored in registry
      const model = agent.runRegistry.getModel(result.runId);
      expect(model).toBeDefined();
    });

    it('should handle multiple tools', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const echoTool = createTool({
        id: 'echo',
        description: 'Echo a message',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => message,
      });

      const uppercaseTool = createTool({
        id: 'uppercase',
        description: 'Convert to uppercase',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => text.toUpperCase(),
      });

      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        tools: { echo: echoTool, uppercase: uppercaseTool },
        pubsub,
      });

      const result = await agent.prepare('Use both tools');

      const tools = agent.runRegistry.getTools(result.runId);
      expect(Object.keys(tools)).toContain('echo');
      expect(Object.keys(tools)).toContain('uppercase');
    });
  });
}
