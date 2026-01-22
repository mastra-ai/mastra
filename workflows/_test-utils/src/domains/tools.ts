/**
 * Tools tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel, createTextStreamModel } from '../mock-models';

export function createToolsTests({ getPubSub }: DurableAgentTestContext) {
  describe('tool registration', () => {
    it('should register tools with execute functions in registry', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      const echoTool = createTool({
        id: 'echo',
        description: 'Echo the input',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => `Echo: ${message}`,
      });

      const agent = new DurableAgent({
        id: 'tool-registration-agent',
        name: 'Tool Registration Agent',
        instructions: 'Use tools',
        model: mockModel,
        tools: { echo: echoTool },
        pubsub,
      });

      const result = await agent.prepare('Test');

      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools.echo).toBeDefined();
      expect(typeof tools.echo.execute).toBe('function');

      // Execute the tool directly
      const execResult = await tools.echo.execute!({ message: 'hello' }, {} as any);
      expect(execResult).toBe('Echo: hello');
    });

    it('should handle multiple tools', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

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

      const agent = new DurableAgent({
        id: 'multi-tool-agent',
        name: 'Multi Tool Agent',
        instructions: 'Calculate',
        model: mockModel,
        tools: { add: addTool, multiply: multiplyTool },
        pubsub,
      });

      const result = await agent.prepare('Calculate something');

      const tools = agent.runRegistry.getTools(result.runId);
      expect(Object.keys(tools)).toHaveLength(2);
      expect(tools.add).toBeDefined();
      expect(tools.multiply).toBeDefined();

      // Test both tools
      expect(await tools.add.execute!({ a: 2, b: 3 }, {} as any)).toBe(5);
      expect(await tools.multiply.execute!({ a: 2, b: 3 }, {} as any)).toBe(6);
    });

    it('should handle tools with complex input schemas', async () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

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

      const agent = new DurableAgent({
        id: 'complex-tool-agent',
        name: 'Complex Tool Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { complex: complexTool },
        pubsub,
      });

      const result = await agent.prepare('Test');

      const tools = agent.runRegistry.getTools(result.runId);
      const execResult = await tools.complex.execute!(
        {
          name: 'test',
          age: 25,
          tags: ['a', 'b'],
          metadata: { key: 'foo', value: 123 },
        },
        {} as any,
      );

      expect(execResult).toEqual({
        received: {
          name: 'test',
          age: 25,
          tags: ['a', 'b'],
          metadata: { key: 'foo', value: 123 },
        },
      });
    });

    it('should serialize tool metadata without execute functions', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: async ({ input }) => `Result: ${input}`,
      });

      const agent = new DurableAgent({
        id: 'tool-serialization-agent',
        name: 'Tool Serialization Agent',
        instructions: 'Test',
        model: mockModel,
        tools: { testTool },
        pubsub,
      });

      const result = await agent.prepare('Use the tool');

      // Tool metadata should be serializable
      const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
      expect(() => JSON.parse(serialized)).not.toThrow();

      // But the actual tools in registry should have execute functions
      const tools = agent.runRegistry.getTools(result.runId);
      expect(typeof tools.testTool?.execute).toBe('function');
    });
  });
}
