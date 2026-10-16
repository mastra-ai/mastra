/**
 * Type tests for @mastra/client-js Agent resource
 * Tests generate and stream methods
 */
import { expectTypeOf, describe, it } from 'vitest';
import type { FullOutput } from '@mastra/core/stream';
import { MastraClient } from '@mastra/client-js';
import type { StreamParams } from '@mastra/client-js';
import { z } from 'zod/v3';
import { z as zv4 } from 'zod/v4';

// Create a client instance for testing
const client = new MastraClient({ baseUrl: 'http://localhost:3000' });
const agent = client.getAgent('test-agent');

// Test schemas
const sentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number(),
});

const sentimentSchemaV4 = zv4.object({
  sentiment: zv4.enum(['positive', 'negative', 'neutral']),
  confidence: zv4.number(),
});

describe('generate', () => {
  it('should accept string messages', async () => {
    const result = await agent.generate('Hello');
    expectTypeOf(result).toHaveProperty('text');
    expectTypeOf(result).toHaveProperty('object');
    expectTypeOf(result).toEqualTypeOf<FullOutput<undefined>>();
  });

  it('should accept array of messages', async () => {
    const result = await agent.generate([{ role: 'user', content: 'Hello' }]);
  });

  it('should return typed object when structuredOutput is provided (zod v3)', async () => {
    const result = await agent.generate('Analyze', {
      structuredOutput: { schema: sentimentSchema },
    });

    expectTypeOf(result.object).toMatchObjectType<{
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
    }>();
  });

  it('should return typed object when structuredOutput is provided (zod v4)', async () => {
    const result = await agent.generate('Analyze', {
      structuredOutput: { schema: sentimentSchemaV4 },
    });

    expectTypeOf(result.object).toMatchObjectType<{
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
    }>();
  });

  it('should infer complex nested schema types', async () => {
    const complexSchema = z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          roles: z.array(z.enum(['admin', 'user', 'guest'])),
        }),
      ),
      metadata: z.object({
        total: z.number(),
        page: z.number(),
      }),
    });

    const result = await agent.generate('Get users', {
      structuredOutput: { schema: complexSchema },
    });

    expectTypeOf(result.object).toMatchObjectType<{
      users: Array<{
        id: string;
        name: string;
        roles: ('admin' | 'user' | 'guest')[];
      }>;
      metadata: {
        total: number;
        page: number;
      };
    }>();
  });

  it('should accept options with maxSteps', async () => {
    const result = await agent.generate('Hello', {
      maxSteps: 10,
    });
  });

  it('should accept memory options', async () => {
    const result = await agent.generate('Hello', {
      memory: {
        resource: 'user-123',
        thread: 'thread-456',
      },
    });
  });

  it('should accept requestContext options', async () => {
    const result = await agent.generate('Hello', {
      requestContext: {
        userId: 'user-123',
      },
    });
  });
});

describe('stream', () => {
  it('should return Response with processDataStream method', async () => {
    const result = await agent.stream('Hello');
    expectTypeOf(result).toExtend<Response>();
    expectTypeOf(result).toHaveProperty('processDataStream');
  });

  it('should accept structured output (zod v3)', async () => {
    const result = await agent.stream('Analyze', {
      structuredOutput: { schema: sentimentSchema },
    });
    expectTypeOf(result).toExtend<Response>();
  });

  it('should accept structured output (zod v4)', async () => {
    const result = await agent.stream('Analyze', {
      structuredOutput: { schema: sentimentSchemaV4 },
    });
    expectTypeOf(result).toExtend<Response>();
  });

  it('should accept options with maxSteps', async () => {
    const result = await agent.stream('Hello', {
      maxSteps: 10,
    });
    expectTypeOf(result).toExtend<Response>();
  });

  it('should accept memory options', async () => {
    const result = await agent.stream('Hello', {
      memory: {
        resource: 'user-123',
        thread: 'thread-456',
      },
    });
    expectTypeOf(result).toExtend<Response>();
  });

  it('should accept requestContext options', async () => {
    const result = await agent.generate('Hello', {
      requestContext: {
        userId: 'user-123',
      },
    });
  });
});

describe('StreamParams typing', () => {
  it('should type StreamParams without structured output', () => {
    const params: StreamParams = {
      messages: 'Hello',
      maxSteps: 10,
    };
    expectTypeOf(params).toExtend<StreamParams>();
  });

  it('should type StreamParams with structured output (zod v3)', () => {
    type OutputType = z.infer<typeof sentimentSchema>;

    const params: StreamParams<OutputType> = {
      messages: 'Hello',
      structuredOutput: { schema: sentimentSchema },
    };
    expectTypeOf(params).toExtend<StreamParams<OutputType>>();
  });

  it('should type StreamParams with structured output (zod v4)', () => {
    type OutputType = zv4.infer<typeof sentimentSchemaV4>;

    const params: StreamParams<OutputType> = {
      messages: 'Hello',
      structuredOutput: { schema: sentimentSchemaV4 },
    };
    expectTypeOf(params).toExtend<StreamParams<OutputType>>();
  });
});
