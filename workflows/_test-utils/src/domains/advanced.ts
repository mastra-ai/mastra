/**
 * Advanced tests for DurableAgent
 *
 * These tests cover:
 * - Instructions and context handling
 * - Message format handling
 * - Workflow state serialization
 * - Model configuration
 * - Agent ID and name handling
 * - Run ID and message ID generation
 *
 * Note: Tests for DurableAgent-specific features (runRegistry, lazy initialization)
 * are in a separate file: advanced-durable-only.ts
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createAdvancedTests({ createAgent }: DurableAgentTestContext) {
  describe('instructions handling', () => {
    it('should include agent instructions in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'instructions-agent',
        name: 'Instructions Agent',
        instructions: 'You are a helpful assistant that speaks formally.',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');

      expect(result.workflowInput.messageListState).toBeDefined();
      expect(result.workflowInput.agentId).toMatch(/^instructions-agent/);
    });

    it('should handle array instructions', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'array-instructions-agent',
        name: 'Array Instructions Agent',
        instructions: ['First instruction.', 'Second instruction.', 'Third instruction.'],
        model: mockModel,
      });

      const result = await agent.prepare('Hello');
      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle empty instructions', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'no-instructions-agent',
        name: 'No Instructions Agent',
        instructions: '',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');
      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle instructions override in stream options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'override-instructions-agent',
        name: 'Override Instructions Agent',
        instructions: 'Default instructions',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        instructions: 'Override instructions for this request',
      });

      expect(result.workflowInput.messageListState).toBeDefined();
    });
  });

  describe('context handling', () => {
    it('should include context messages in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'context-agent',
        name: 'Context Agent',
        instructions: 'You are helpful',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        context: [{ role: 'user', content: 'Previous context message' }],
      });

      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle string context', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'string-context-agent',
        name: 'String Context Agent',
        instructions: 'You are helpful',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        context: 'Some context information',
      });

      expect(result.workflowInput.messageListState).toBeDefined();
    });
  });

  describe('message format handling', () => {
    it('should handle string message input', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'string-message-agent',
        name: 'String Message Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Simple string message');

      expect(result.workflowInput.messageListState).toBeDefined();
      expect(result.runId).toBeDefined();
    });

    it('should handle array of strings', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'array-string-agent',
        name: 'Array String Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare(['First message', 'Second message', 'Third message']);

      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle message objects with role and content', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'message-object-agent',
        name: 'Message Object Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]);

      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle mixed message formats', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'mixed-format-agent',
        name: 'Mixed Format Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare([{ role: 'user', content: 'First as object' }]);

      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle empty content messages', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'empty-content-agent',
        name: 'Empty Content Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare({ role: 'user', content: '' });

      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle multi-part content messages', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'multipart-agent',
        name: 'Multipart Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare({
        role: 'user',
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
        ],
      });

      expect(result.workflowInput.messageListState).toBeDefined();
    });
  });

  describe('workflow state serialization', () => {
    it('should create fully JSON-serializable workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const testTool = createTool({
        id: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => value,
      });

      const agent = await createAgent({
        id: 'serialization-test-agent',
        name: 'Serialization Test Agent',
        instructions: 'Test instructions',
        model: mockModel,
        tools: { testTool },
      });

      const result = await agent.prepare('Test message', {
        maxSteps: 5,
        toolChoice: 'auto',
        memory: {
          thread: 'thread-123',
          resource: 'user-456',
        },
      });

      const serialized = JSON.stringify(result.workflowInput);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.runId).toBe(result.runId);
      expect(deserialized.agentId).toMatch(/^serialization-test-agent/);
      expect(deserialized.agentName).toBe('Serialization Test Agent');
      expect(deserialized.messageId).toBe(result.messageId);
      expect(deserialized.messageListState).toBeDefined();
      expect(deserialized.toolsMetadata).toBeDefined();
      expect(deserialized.modelConfig).toBeDefined();
      expect(deserialized.options).toBeDefined();
      expect(deserialized.state).toBeDefined();
    });

    it('should serialize model configuration correctly', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'model-config-agent',
        name: 'Model Config Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test');

      const serialized = JSON.stringify(result.workflowInput.modelConfig);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.provider).toBeDefined();
      expect(deserialized.modelId).toBeDefined();
      expect(typeof deserialized.provider).toBe('string');
      expect(typeof deserialized.modelId).toBe('string');
    });

    it('should serialize state with memory info correctly', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'state-serialize-agent',
        name: 'State Serialize Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test', {
        memory: {
          thread: 'thread-abc',
          resource: 'user-xyz',
        },
      });

      const serialized = JSON.stringify(result.workflowInput.state);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.threadId).toBe('thread-abc');
      expect(deserialized.resourceId).toBe('user-xyz');
    });

    it('should serialize options correctly', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'options-serialize-agent',
        name: 'Options Serialize Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test', {
        maxSteps: 10,
        toolChoice: 'required',
        requireToolApproval: true,
        toolCallConcurrency: 3,
        modelSettings: { temperature: 0.8 },
      });

      const serialized = JSON.stringify(result.workflowInput.options);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.maxSteps).toBe(10);
      expect(deserialized.toolChoice).toBe('required');
      expect(deserialized.requireToolApproval).toBe(true);
      expect(deserialized.toolCallConcurrency).toBe(3);
      expect(deserialized.temperature).toBe(0.8);
    });

    it('should handle complex tool metadata serialization', async () => {
      const mockModel = createTextStreamModel('Hello');

      const complexTool = createTool({
        id: 'complex-tool',
        description: 'A complex tool with nested schema',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
          filters: z
            .object({
              category: z.enum(['A', 'B', 'C']).optional(),
              minValue: z.number().optional(),
              tags: z.array(z.string()).optional(),
            })
            .optional(),
          pagination: z
            .object({
              page: z.number().default(1),
              limit: z.number().default(10),
            })
            .optional(),
        }),
        execute: async input => ({ results: [], query: input.query }),
      });

      const agent = await createAgent({
        id: 'complex-tool-agent',
        name: 'Complex Tool Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { complexTool },
      });

      const result = await agent.prepare('Test');

      const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });

  describe('model configuration', () => {
    it('should extract model provider and modelId', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'model-extract-agent',
        name: 'Model Extract Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const result = await agent.prepare('Test');

      expect(result.workflowInput.modelConfig.provider).toBeDefined();
      expect(result.workflowInput.modelConfig.modelId).toBeDefined();
    });
  });

  describe('ID and name handling', () => {
    it('should use explicit name when provided', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'agent-id',
        name: 'Explicit Name',
        instructions: 'Test',
        model: mockModel,
      });

      // InngestDurableAgent adds suffix, so use regex
      expect(agent.id).toMatch(/^agent-id/);
      expect(agent.name).toBe('Explicit Name');

      const result = await agent.prepare('Test');
      expect(result.workflowInput.agentId).toMatch(/^agent-id/);
      expect(result.workflowInput.agentName).toBe('Explicit Name');
    });

    it('should use ID as name when name not provided', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'agent-id-as-name',
        instructions: 'Test',
        model: mockModel,
      });

      expect(agent.id).toMatch(/^agent-id-as-name/);
      // Name should match the full ID (including any suffix)
      expect(agent.name).toMatch(/^agent-id-as-name/);
    });

    it('should handle special characters in ID', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'agent-with-dashes_and_underscores',
        name: 'Special ID Agent',
        instructions: 'Test',
        model: mockModel,
      });

      expect(agent.id).toMatch(/^agent-with-dashes_and_underscores/);

      const result = await agent.prepare('Test');
      expect(result.workflowInput.agentId).toMatch(/^agent-with-dashes_and_underscores/);
    });
  });

  describe('ID generation', () => {
    it('should generate unique runIds for each prepare call', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'unique-id-agent',
        name: 'Unique ID Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const results = await Promise.all([
        agent.prepare('Message 1'),
        agent.prepare('Message 2'),
        agent.prepare('Message 3'),
        agent.prepare('Message 4'),
        agent.prepare('Message 5'),
      ]);

      const runIds = results.map(r => r.runId);
      const uniqueRunIds = new Set(runIds);

      expect(uniqueRunIds.size).toBe(5);
    });

    it('should generate unique messageIds for each prepare call', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'unique-messageid-agent',
        name: 'Unique MessageID Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const results = await Promise.all([
        agent.prepare('Message 1'),
        agent.prepare('Message 2'),
        agent.prepare('Message 3'),
      ]);

      const messageIds = results.map(r => r.messageId);
      const uniqueMessageIds = new Set(messageIds);

      expect(uniqueMessageIds.size).toBe(3);
    });

    it('should allow custom runId via options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'custom-runid-agent',
        name: 'Custom RunID Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const customRunId = 'my-custom-run-id-12345';
      const { runId, cleanup } = await agent.stream('Test', {
        runId: customRunId,
      });

      expect(runId).toBe(customRunId);
      cleanup();
    });
  });
}
