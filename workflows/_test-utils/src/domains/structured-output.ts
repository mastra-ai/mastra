/**
 * Structured output tests for DurableAgent
 *
 * Tests for typed structured output with Zod and JSON schemas in durable execution.
 * Validates that structuredOutput option works correctly through the durable workflow.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createStructuredOutputTests({ createAgent }: DurableAgentTestContext) {
  describe('structured output', () => {
    describe('ZodSchema structured output', () => {
      it('should support ZodSchema structured output type', async () => {
        const mockModel = createTextStreamModel(
          JSON.stringify({
            elements: [
              { year: '2012', winner: 'Barack Obama' },
              { year: '2016', winner: 'Donald Trump' },
            ],
          }),
        );

        const agent = await createAgent({
          id: 'election-agent',
          name: 'US Election Agent',
          instructions: 'You know about past US elections',
          model: mockModel,
        });

        const result = await agent.prepare('Give me the winners of 2012 and 2016 US presidential elections', {
          structuredOutput: {
            schema: z.object({
              elements: z.array(
                z.object({
                  winner: z.string(),
                  year: z.string(),
                }),
              ),
            }),
          },
        });

        expect(result.runId).toBeDefined();
        expect(result.workflowInput).toBeDefined();
        expect(result.workflowInput.options).toBeDefined();
      });

      it('should handle array schemas wrapped in elements', async () => {
        const mockModel = createTextStreamModel(
          JSON.stringify({
            elements: [
              { name: 'Alice', age: 30 },
              { name: 'Bob', age: 25 },
            ],
          }),
        );

        const agent = await createAgent({
          id: 'array-schema-agent',
          name: 'Array Schema Agent',
          instructions: 'Return user data',
          model: mockModel,
        });

        const result = await agent.prepare('List all users', {
          structuredOutput: {
            schema: z.array(
              z.object({
                name: z.string(),
                age: z.number(),
              }),
            ),
          },
        });

        expect(result.runId).toBeDefined();
        expect(result.workflowInput).toBeDefined();
      });
    });

    describe('JSONSchema7 structured output', () => {
      it('should support JSONSchema7 structured output type', async () => {
        const mockModel = createTextStreamModel(
          JSON.stringify({
            winners: [
              { year: '2012', winner: 'Barack Obama' },
              { year: '2016', winner: 'Donald Trump' },
            ],
          }),
        );

        const agent = await createAgent({
          id: 'json-schema-agent',
          name: 'JSON Schema Agent',
          instructions: 'You know about past US elections',
          model: mockModel,
        });

        const result = await agent.prepare('Give me the winners of 2012 and 2016 US presidential elections', {
          structuredOutput: {
            schema: {
              type: 'object',
              properties: {
                winners: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      winner: { type: 'string' },
                      year: { type: 'string' },
                    },
                    required: ['winner', 'year'],
                  },
                },
              },
              required: ['winners'],
            },
          },
        });

        expect(result.runId).toBeDefined();
        expect(result.workflowInput).toBeDefined();
      });
    });

    describe('streaming structured output', () => {
      it('should stream structured output correctly in chunks', async () => {
        const mockModel = createTextStreamModel(
          JSON.stringify({
            name: 'Alice',
            email: 'alice@example.com',
            role: 'admin',
          }),
        );

        const agent = await createAgent({
          id: 'streaming-schema-agent',
          name: 'Streaming Schema Agent',
          instructions: 'Return user profile',
          model: mockModel,
        });

        const { runId, cleanup } = await agent.stream('Get user profile', {
          structuredOutput: {
            schema: z.object({
              name: z.string(),
              email: z.string(),
              role: z.string(),
            }),
          },
        });

        expect(runId).toBeDefined();
        cleanup();
      });

      it('should handle complex nested object schemas in stream', async () => {
        const mockModel = createTextStreamModel(
          JSON.stringify({
            user: {
              profile: {
                name: 'Alice',
                contact: {
                  email: 'alice@example.com',
                  phone: '555-1234',
                },
              },
              settings: {
                theme: 'dark',
                notifications: true,
              },
            },
          }),
        );

        const agent = await createAgent({
          id: 'nested-schema-agent',
          name: 'Nested Schema Agent',
          instructions: 'Return nested user data',
          model: mockModel,
        });

        const { runId, cleanup } = await agent.stream('Get complete user data', {
          structuredOutput: {
            schema: z.object({
              user: z.object({
                profile: z.object({
                  name: z.string(),
                  contact: z.object({
                    email: z.string(),
                    phone: z.string(),
                  }),
                }),
                settings: z.object({
                  theme: z.string(),
                  notifications: z.boolean(),
                }),
              }),
            }),
          },
        });

        expect(runId).toBeDefined();
        cleanup();
      });
    });

    describe('edge cases', () => {
      it('should handle empty object schemas', async () => {
        const mockModel = createTextStreamModel(JSON.stringify({}));

        const agent = await createAgent({
          id: 'empty-schema-agent',
          name: 'Empty Schema Agent',
          instructions: 'Return empty object',
          model: mockModel,
        });

        const result = await agent.prepare('Get empty data', {
          structuredOutput: {
            schema: z.object({}),
          },
        });

        expect(result.runId).toBeDefined();
      });

      it('should handle schemas with optional fields', async () => {
        const mockModel = createTextStreamModel(JSON.stringify({ name: 'Alice' }));

        const agent = await createAgent({
          id: 'optional-fields-agent',
          name: 'Optional Fields Agent',
          instructions: 'Return user with optional fields',
          model: mockModel,
        });

        const result = await agent.prepare('Get user data', {
          structuredOutput: {
            schema: z.object({
              name: z.string(),
              email: z.string().optional(),
              age: z.number().optional(),
            }),
          },
        });

        expect(result.runId).toBeDefined();
      });

      it('should handle schemas with union types', async () => {
        const mockModel = createTextStreamModel(
          JSON.stringify({
            result: { type: 'success', data: { id: 123 } },
          }),
        );

        const agent = await createAgent({
          id: 'union-schema-agent',
          name: 'Union Schema Agent',
          instructions: 'Return result with union type',
          model: mockModel,
        });

        const result = await agent.prepare('Get result', {
          structuredOutput: {
            schema: z.object({
              result: z.union([
                z.object({ type: z.literal('success'), data: z.object({ id: z.number() }) }),
                z.object({ type: z.literal('error'), message: z.string() }),
              ]),
            }),
          },
        });

        expect(result.runId).toBeDefined();
      });
    });
  });

  describe('structured output workflow integration', () => {
    it('should include structuredOutput schema info in workflow input serialization', async () => {
      const mockModel = createTextStreamModel(JSON.stringify({ count: 42, items: ['a', 'b', 'c'] }));

      const schema = z.object({
        count: z.number(),
        items: z.array(z.string()),
      });

      const agent = await createAgent({
        id: 'serialization-test-agent',
        name: 'Serialization Test Agent',
        instructions: 'Test serialization',
        model: mockModel,
      });

      const result = await agent.prepare('Get data', {
        structuredOutput: {
          schema,
        },
      });

      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.runId).toBe(result.runId);
      // Agent ID may have implementation-specific suffix
      expect(parsed.agentId).toMatch(/^serialization-test-agent/);
    });

    it('should properly serialize complex schemas with descriptions', async () => {
      const mockModel = createTextStreamModel(JSON.stringify({ status: 'active' }));

      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).describe('Current user status'),
      });

      const agent = await createAgent({
        id: 'described-schema-agent',
        name: 'Described Schema Agent',
        instructions: 'Test described schemas',
        model: mockModel,
      });

      const result = await agent.prepare('Get status', {
        structuredOutput: {
          schema,
        },
      });

      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();
      expect(JSON.parse(serialized)).toBeDefined();
    });
  });
}
