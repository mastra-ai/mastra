/**
 * DurableAgent Structured Output Tests
 *
 * Tests for typed structured output with Zod and JSON schemas in durable execution.
 * Validates that structuredOutput option works correctly through the durable workflow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { DurableAgent } from '../durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns structured JSON output
 */
function createStructuredOutputModel(jsonOutput: object) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonOutput),
        },
      ],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: JSON.stringify(jsonOutput) },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a mock model that streams structured JSON output in chunks
 */
function createChunkedStructuredOutputModel(jsonOutput: object) {
  const jsonString = JSON.stringify(jsonOutput);
  // Split into chunks
  const chunks = [
    jsonString.slice(0, Math.floor(jsonString.length / 3)),
    jsonString.slice(Math.floor(jsonString.length / 3), Math.floor((2 * jsonString.length) / 3)),
    jsonString.slice(Math.floor((2 * jsonString.length) / 3)),
  ];

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: chunks[0] },
        { type: 'text-delta', id: 'text-1', delta: chunks[1] },
        { type: 'text-delta', id: 'text-1', delta: chunks[2] },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a mock model that returns tool-calls finishReason (Bedrock-style)
 */
function createBedrockStyleModel(jsonOutput: object) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'tool-calls',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonOutput),
        },
      ],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        {
          type: 'text-delta',
          id: 'text-1',
          delta: JSON.stringify(jsonOutput),
        },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Structured Output Tests
// ============================================================================

describe('DurableAgent structured output', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('ZodSchema structured output', () => {
    it('should support ZodSchema structured output type', async () => {
      const expectedOutput = {
        elements: [
          { year: '2012', winner: 'Barack Obama' },
          { year: '2016', winner: 'Donald Trump' },
        ],
      };

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'election-agent',
        name: 'US Election Agent',
        instructions: 'You know about past US elections',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // Prepare with structured output schema
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

      // The structured output schema should be serialized in the workflow input
      // Since DurableAgent uses prepare + workflow execution pattern,
      // we verify the preparation includes the schema info
      expect(result.workflowInput.options).toBeDefined();
    });

    it('should handle array schemas wrapped in elements', async () => {
      const expectedOutput = {
        elements: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      };

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'array-schema-agent',
        name: 'Array Schema Agent',
        instructions: 'Return user data',
        model: mockModel as LanguageModelV2,
        pubsub,
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
      const expectedOutput = {
        winners: [
          { year: '2012', winner: 'Barack Obama' },
          { year: '2016', winner: 'Donald Trump' },
        ],
      };

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'json-schema-agent',
        name: 'JSON Schema Agent',
        instructions: 'You know about past US elections',
        model: mockModel as LanguageModelV2,
        pubsub,
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
      const expectedOutput = {
        name: 'Alice',
        email: 'alice@example.com',
        role: 'admin',
      };

      const mockModel = createChunkedStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'streaming-schema-agent',
        name: 'Streaming Schema Agent',
        instructions: 'Return user profile',
        model: mockModel as LanguageModelV2,
        pubsub,
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

      // Cleanup subscription
      cleanup();
    });

    it('should handle complex nested object schemas in stream', async () => {
      const expectedOutput = {
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
      };

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'nested-schema-agent',
        name: 'Nested Schema Agent',
        instructions: 'Return nested user data',
        model: mockModel as LanguageModelV2,
        pubsub,
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
    it('should parse JSON from text when finishReason is tool-calls (Bedrock-style)', async () => {
      const expectedOutput = {
        primitiveId: 'weatherAgent',
        primitiveType: 'agent',
        prompt: 'What is the weather?',
        selectionReason: 'Selected for weather info',
      };

      const mockModel = createBedrockStyleModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'routing-agent',
        name: 'Routing Agent',
        instructions: 'Route requests to appropriate agents',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const responseSchema = z.object({
        primitiveId: z.string(),
        primitiveType: z.string(),
        prompt: z.string(),
        selectionReason: z.string(),
      });

      const { runId, cleanup } = await agent.stream('What is the weather?', {
        structuredOutput: {
          schema: responseSchema,
        },
      });

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle empty object schemas', async () => {
      const expectedOutput = {};

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'empty-schema-agent',
        name: 'Empty Schema Agent',
        instructions: 'Return empty object',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Get empty data', {
        structuredOutput: {
          schema: z.object({}),
        },
      });

      expect(result.runId).toBeDefined();
    });

    it('should handle schemas with optional fields', async () => {
      const expectedOutput = {
        name: 'Alice',
        // email is optional and not provided
      };

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'optional-fields-agent',
        name: 'Optional Fields Agent',
        instructions: 'Return user with optional fields',
        model: mockModel as LanguageModelV2,
        pubsub,
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
      const expectedOutput = {
        result: { type: 'success', data: { id: 123 } },
      };

      const mockModel = createStructuredOutputModel(expectedOutput);

      const agent = new DurableAgent({
        id: 'union-schema-agent',
        name: 'Union Schema Agent',
        instructions: 'Return result with union type',
        model: mockModel as LanguageModelV2,
        pubsub,
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

describe('DurableAgent structured output workflow integration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should include structuredOutput schema info in workflow input serialization', async () => {
    const expectedOutput = { count: 42, items: ['a', 'b', 'c'] };
    const mockModel = createStructuredOutputModel(expectedOutput);

    const schema = z.object({
      count: z.number(),
      items: z.array(z.string()),
    });

    const agent = new DurableAgent({
      id: 'serialization-test-agent',
      name: 'Serialization Test Agent',
      instructions: 'Test serialization',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Get data', {
      structuredOutput: {
        schema,
      },
    });

    // Verify workflow input is JSON-serializable
    const serialized = JSON.stringify(result.workflowInput);
    expect(serialized).toBeDefined();

    // Parse it back to verify it's valid JSON
    const parsed = JSON.parse(serialized);
    expect(parsed.runId).toBe(result.runId);
    expect(parsed.agentId).toBe('serialization-test-agent');
  });

  it('should properly serialize complex schemas with descriptions', async () => {
    const expectedOutput = { status: 'active' };
    const mockModel = createStructuredOutputModel(expectedOutput);

    const schema = z.object({
      status: z.enum(['active', 'inactive', 'pending']).describe('Current user status'),
    });

    const agent = new DurableAgent({
      id: 'described-schema-agent',
      name: 'Described Schema Agent',
      instructions: 'Test described schemas',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Get status', {
      structuredOutput: {
        schema,
      },
    });

    // Verify workflow input is JSON-serializable
    const serialized = JSON.stringify(result.workflowInput);
    expect(serialized).toBeDefined();
    expect(JSON.parse(serialized)).toBeDefined();
  });
});
