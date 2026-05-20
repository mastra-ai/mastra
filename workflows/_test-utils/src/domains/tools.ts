/**
 * Tools tests for DurableAgent
 *
 * These tests verify that tools are properly configured and that
 * tool metadata is serializable for workflow input.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createToolsTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('tool configuration', () => {
    it('should accept tools in agent config', async () => {
      const mockModel = createTextStreamModel('Hello');

      const echoTool = createTool({
        id: 'echo',
        description: 'Echo the input',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => `Echo: ${message}`,
      });

      const agent = await createAgent({
        id: 'tool-config-agent',
        name: 'Tool Config Agent',
        instructions: 'Use tools',
        model: mockModel,
        tools: { echo: echoTool },
      });

      expect(agent.id).toContain('tool-config-agent');
    });

    it('should accept multiple tools', async () => {
      const mockModel = createTextStreamModel('Hello');

      const addTool = createTool({
        id: 'add',
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => a + b,
      });

      const multiplyTool = createTool({
        id: 'multiply',
        description: 'Multiply two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => a * b,
      });

      const agent = await createAgent({
        id: 'multi-tool-agent',
        name: 'Multi Tool Agent',
        instructions: 'Calculate',
        model: mockModel,
        tools: { add: addTool, multiply: multiplyTool },
      });

      expect(agent.id).toContain('multi-tool-agent');
    });

    it('should serialize tool metadata in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: async ({ input }) => `Result: ${input}`,
      });

      const agent = await createAgent({
        id: 'tool-serialization-agent',
        name: 'Tool Serialization Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { testTool },
      });

      const result = await agent.prepare('Use the tool');

      // Tool metadata should be serializable
      const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should handle tools with complex input schemas', async () => {
      const mockModel = createTextStreamModel('Hello');

      const complexTool = createTool({
        id: 'complex',
        description: 'A tool with complex input',
        inputSchema: z.object({
          name: z.string(),
          age: z.number().optional(),
          tags: z.array(z.string()).optional(),
          metadata: z
            .object({
              key: z.string(),
              value: z.unknown(),
            })
            .optional(),
        }),
        execute: async input => ({ received: input }),
      });

      const agent = await createAgent({
        id: 'complex-tool-agent',
        name: 'Complex Tool Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { complex: complexTool },
      });

      const result = await agent.prepare('Test');

      // Workflow input should be created successfully
      expect(result.workflowInput).toBeDefined();
      expect(result.workflowInput.toolsMetadata).toBeDefined();
    });
  });
}
