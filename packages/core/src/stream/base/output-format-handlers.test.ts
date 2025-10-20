import { convertArrayToReadableStream, convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { asSchema } from 'ai-v5';
import type { JSONSchema7 } from 'ai-v5';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import z3 from 'zod/v3';
import z4 from 'zod/v4';
import type { ChunkType } from '../types';
import { ChunkFrom } from '../types';
import { createObjectStreamTransformer } from './output-format-handlers';

describe('output-format-handlers', () => {
  describe('schema validation', () => {
    it('should validate against zod schema and provide detailed error messages', async () => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number().positive(),
        email: z.string().email(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"nam' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: 'e":"Jo",' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '"age":-5,' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '"email":"invalid"}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
      ];
      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      // Should have error chunk with validation details
      const errorChunk = chunks.find(c => c?.type === 'error');

      expect(errorChunk).toBeDefined();

      expect(errorChunk?.payload?.error).toBeInstanceOf(Error);
      expect((errorChunk?.payload?.error as Error).message).toContain('Structured output validation failed');
      expect((errorChunk?.payload?.error as Error).message).toContain('String must contain at least 3 character(s)');
      expect((errorChunk?.payload?.error as Error).message).toContain('at name');
      expect((errorChunk?.payload?.error as Error).message).toContain('Number must be greater than 0');
      expect((errorChunk?.payload?.error as Error).message).toContain('at age');
      expect((errorChunk?.payload?.error as Error).message).toContain('Invalid email');
      expect((errorChunk?.payload?.error as Error).message).toContain('at email');
      expect((errorChunk?.payload?.error as Error).cause).toBeInstanceOf(z3.ZodError);
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues).toHaveLength(3);
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues[0].message).toContain(
        'String must contain at least 3 character(s)',
      );
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues[0].path).toEqual(['name']);
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues[1].message).toContain(
        'Number must be greater than 0',
      );
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues[1].path).toEqual(['age']);
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues[2].message).toContain('Invalid email');
      expect(((errorChunk?.payload?.error as Error).cause as z3.ZodError).issues[2].path).toEqual(['email']);
    });

    it('should successfully validate correct zod schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"John","age":30}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ name: 'John', age: 30 });
    });

    it('should validate on text-end chunk', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"John"}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      // Verify text-end is emitted first
      const textEndChunk = chunks.find(c => c?.type === 'text-end');
      expect(textEndChunk).toBeDefined();

      // Verify object-result is emitted after text-end
      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ name: 'John' });

      // Verify ordering: text-end comes before object-result
      const textEndIndex = chunks.findIndex(c => c?.type === 'text-end');
      const objectResultIndex = chunks.findIndex(c => c?.type === 'object-result');
      expect(textEndIndex).toBeLessThan(objectResultIndex);
    });

    it('should use zod transform and default values', async () => {
      const schema = z.object({
        name: z.string().transform(s => s.toUpperCase()),
        age: z.number().default(18),
        status: z.string().default('active'),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"john"}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      // Transform should uppercase the name, defaults should be applied
      expect(objectResultChunk?.object).toEqual({ name: 'JOHN', age: 18, status: 'active' });
    });

    it('should validate zod array schema', async () => {
      const schema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      );

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      // Arrays are wrapped in {elements: [...]} by the LLM
      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"elements":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('should validate zod enum schema', async () => {
      const schema = z.enum(['red', 'green', 'blue']);

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      // Enums are wrapped in {result: ""} by the LLM
      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"result":"green"}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toBe('green');
    });

    it('should validate invalid zod enum and provide error', async () => {
      const schema = z.enum(['red', 'green', 'blue']);

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"result":"yellow"}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk?.payload?.error as Error)?.message).toContain('Structured output validation failed');
    });
  });

  describe('zod v3 compatibility', () => {
    it('should validate zod v3 schema with detailed errors', async () => {
      const schema = z3.object({
        name: z3.string().min(3),
        age: z3.number().positive(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.payload?.error).toBeInstanceOf(Error);
      expect((errorChunk?.payload?.error as Error).message).toContain('Structured output validation failed');
    });

    it('should successfully validate zod v3 schema', async () => {
      const schema = z3.object({
        name: z3.string(),
        count: z3.number(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"Alice","count":5}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ name: 'Alice', count: 5 });
    });
  });

  describe('zod v4 compatibility', () => {
    it('should validate zod v4 schema with detailed errors', async () => {
      const schema = z4.object({
        email: z4.string().email(),
        score: z4.number().min(0).max(100),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk?.payload?.error as Error).message).toContain('Structured output validation failed');
    });

    it('should successfully validate zod v4 schema', async () => {
      const schema = z4.object({
        username: z4.string(),
        active: z4.boolean(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"username":"bob","active":true}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ username: 'bob', active: true });
    });
  });

  describe('ai sdk schema compatibility', () => {
    it('should handle AI SDK Schema (already wrapped) correctly', async () => {
      // Create an AI SDK Schema from a Zod schema
      const zodSchema = z.object({
        id: z.string(),
        value: z.number(),
      });
      const aiSdkSchema = asSchema(zodSchema);

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema: aiSdkSchema },
      });

      const streamParts: any[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"id":"abc","value":42}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ id: 'abc', value: 42 });
    });
  });

  describe('json schema compatibility', () => {
    it('should validate json schema successfully', async () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['title', 'price'],
      };

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: any[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"title":"Product","price":29.99}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ title: 'Product', price: 29.99 });
    });

    it('should pass through json schema without strict validation', async () => {
      // JSON Schema doesn't have the same validation capabilities as Zod
      // So we mainly ensure it doesn't error and passes through the data
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      };

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: any[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"id":123}' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ id: 123 });
    });
  });

  describe('token extraction (preprocessText)', () => {
    it('should extract JSON from LMStudio <|message|> token wrapper', async () => {
      const schema = z.object({
        primitiveId: z.string(),
        primitiveType: z.string(),
        prompt: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            id: '1',
            text: '<|channel|>final <|constrain|>JSON<|message|>{"primitiveId":"weatherAgent","primitiveType":"agent","prompt":"What is the weather?"}',
          },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({
        primitiveId: 'weatherAgent',
        primitiveType: 'agent',
        prompt: 'What is the weather?',
      });
    });

    it('should extract JSON from multiline content in <|message|> wrapper', async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            id: '1',
            text: '<|channel|>final <|message|>{\n  "name": "test",\n  "value": 42\n}',
          },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ name: 'test', value: 42 });
    });

    it('should handle JSON wrapped in ```json code blocks', async () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            id: '1',
            text: '```json\n{"title":"Test","count":5}\n```',
          },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({ title: 'Test', count: 5 });
    });
  });

  describe('errorStrategy', () => {
    it('should emit error chunk when errorStrategy is not set', async () => {
      const schema = z.object({
        name: z.string().min(5),
        age: z.number().positive(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk?.payload?.error as Error).message).toContain('Structured output validation failed');
    });

    it('should warn and not emit error chunk when errorStrategy is "warn"', async () => {
      const schema = z.object({
        name: z.string().min(5),
        age: z.number().positive(),
      });

      const mockLogger = {
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const transformer = createObjectStreamTransformer({
        structuredOutput: {
          schema,
          errorStrategy: 'warn',
        },
        logger: mockLogger as any,
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      // Should not have error chunk
      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeUndefined();

      // Should not have object-result chunk
      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeUndefined();

      // Should have called logger.warn
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Structured output validation failed'));
    });

    it('should use fallbackValue when errorStrategy is "fallback"', async () => {
      const schema = z.object({
        name: z.string().min(5),
        age: z.number().positive(),
      });

      const fallbackValue = { name: 'Default', age: 0 };

      const transformer = createObjectStreamTransformer({
        structuredOutput: {
          schema,
          errorStrategy: 'fallback',
          fallbackValue,
        },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: '1' },
        },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
      ];

      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      // Should not have error chunk
      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeUndefined();

      // Should have object-result chunk with fallback value
      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual(fallbackValue);
    });
  });
});
