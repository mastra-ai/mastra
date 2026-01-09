import { convertArrayToReadableStream, convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import type { ChunkType } from '../types';
import { ChunkFrom } from '../types';
import { createObjectStreamTransformer, createJsonTextStreamTransformer } from './output-format-handlers';

describe('createObjectStreamTransformer', () => {
  describe('schema validation', () => {
    it('should validate against zod schema and provide detailed error messages', async () => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number().positive(),
        email: z.email(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"nam' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: 'e":"Jo",' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '"age":-5,' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '"email":"invalid"}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
        },
      ];
      // @ts-expect-error - web/stream readable stream type error
      const stream = convertArrayToReadableStream(streamParts).pipeThrough(transformer);
      const chunks = await convertAsyncIterableToArray(stream);

      // With 'warn' strategy, should not have error chunk
      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeUndefined();
    });

    it('should successfully validate correct zod schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"name":"John","age":30}' },
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
      expect(objectResultChunk!.object).toEqual({ name: 'John', age: 30 });
    });

    it('should validate on text-end chunk', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"name":"John"}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
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
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"name":"john"}' },
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
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      // Arrays are wrapped in {elements: [...]} by the LLM
      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"elements":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}' },
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
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      // Enums are wrapped in {result: ""} by the LLM
      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"result":"green"}' },
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
  });

  describe('zod v4 compatibility', () => {
    it('should validate zod v4 schema with detailed errors', async () => {
      const schema = z.object({
        email: z.string().email(),
        score: z.number().min(0).max(100),
      });

      const mockLogger = {
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
        logger: mockLogger as any,
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"email":"invalid","score":150}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
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
      await convertAsyncIterableToArray(stream);

      // With 'warn' strategy, should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Structured output validation failed'));
    });

    it('should successfully validate zod v4 schema', async () => {
      const schema = z.object({
        username: z.string(),
        active: z.boolean(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"username":"bob","active":true}' },
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

  describe('token extraction (preprocessText)', () => {
    it('should extract JSON from LMStudio <|message|> token wrapper', async () => {
      const schema = z.object({
        primitiveId: z.string(),
        primitiveType: z.string(),
        prompt: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
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

    it('should handle JSON wrapped in ```json code blocks', async () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
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

  describe('unescaped newlines in JSON strings', () => {
    it('should handle LLM output with actual newlines in string values instead of \\n escape sequences', async () => {
      const schema = z.object({
        fieldId: z.string(),
        content: z.string(),
        summary: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      // Simulates LLM outputting actual newlines instead of \n escape sequences
      const invalidJsonWithActualNewlines = `{"fieldId": "interview_notes", "content": "The candidate discussed:
- Point 1
- Point 2
- Point 3", "summary": "Good candidate
with strong skills"}`;

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: invalidJsonWithActualNewlines },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
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

      // The system should handle this gracefully and parse the content
      const objectResultChunk = chunks.find(c => c?.type === 'object-result');
      expect(objectResultChunk).toBeDefined();
      expect(objectResultChunk?.object).toEqual({
        fieldId: 'interview_notes',
        content: `The candidate discussed:
- Point 1
- Point 2
- Point 3`,
        summary: `Good candidate
with strong skills`,
      });

      // Should NOT have an error chunk
      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeUndefined();
    });

    it('should handle streaming chunks with unescaped newlines spread across deltas', async () => {
      const schema = z.object({
        notes: z.string(),
        recommendation: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        schema,
        errorStrategy: { strategy: 'warn' },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"notes": "First line' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          // Actual newline in the middle of a string value
          payload: { id: 'text-1', text: '\nSecond line' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '\nThird line", "recommendation": "Proceed' },
        },
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '\nwith interview"}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
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
        notes: 'First line\nSecond line\nThird line',
        recommendation: 'Proceed\nwith interview',
      });

      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeUndefined();
    });
  });

  describe('errorStrategy', () => {
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
        schema,
        errorStrategy: { strategy: 'warn' },
        logger: mockLogger as any,
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
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
        schema,
        errorStrategy: { strategy: 'fallback', fallbackValue },
      });

      const streamParts: ChunkType<typeof schema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: '{"name":"Jo","age":-5}' },
        },
        {
          type: 'text-end',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1' },
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

describe('createJsonTextStreamTransformer', () => {
  it('should transform object chunks to JSON strings for objects', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const transformer = createJsonTextStreamTransformer(schema);

    const chunks: ChunkType<z.infer<typeof schema>>[] = [
      {
        type: 'object',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        object: { name: 'John', age: 30 },
      },
    ];

    // @ts-expect-error - web/stream readable stream type error
    const stream = convertArrayToReadableStream(chunks).pipeThrough(transformer);
    const results = await convertAsyncIterableToArray(stream);

    expect(results).toEqual(['{"name":"John","age":30}']);
  });

  it('should stream array elements incrementally', async () => {
    const schema = z.array(z.object({ id: z.number() }));

    const transformer = createJsonTextStreamTransformer(schema);

    const chunks: ChunkType<z.infer<typeof schema>>[] = [
      {
        type: 'object',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        object: [] as { id: number }[],
      },
      {
        type: 'object',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        object: [{ id: 1 }],
      },
      {
        type: 'object',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        object: [{ id: 1 }, { id: 2 }],
      },
    ];

    // @ts-expect-error - web/stream readable stream type error
    const stream = convertArrayToReadableStream(chunks).pipeThrough(transformer);
    const results = await convertAsyncIterableToArray(stream);

    // First chunk is empty array, opens bracket
    // Second chunk adds first element
    // Third chunk adds second element
    // Flush closes the bracket
    expect(results).toEqual(['[', '{"id":1}', ',{"id":2}', ']']);
  });

  it('should emit complete array as single JSON when first chunk has elements', async () => {
    const schema = z.array(z.object({ id: z.number() }));

    const transformer = createJsonTextStreamTransformer(schema);

    const chunks: ChunkType<z.infer<typeof schema>>[] = [
      {
        type: 'object',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        object: [{ id: 1 }, { id: 2 }],
      },
    ];

    // @ts-expect-error - web/stream readable stream type error
    const stream = convertArrayToReadableStream(chunks).pipeThrough(transformer);
    const results = await convertAsyncIterableToArray(stream);

    // Single chunk with complete array - emitted as single JSON string
    expect(results).toEqual(['[{"id":1},{"id":2}]']);
  });

  it('should skip non-object chunks', async () => {
    const schema = z.object({ name: z.string() });

    const transformer = createJsonTextStreamTransformer(schema);

    const chunks: ChunkType<z.infer<typeof schema>>[] = [
      {
        type: 'text-delta',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        payload: { id: 'text-1', text: 'some text' },
      },
      {
        type: 'object',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        object: { name: 'John' },
      },
    ];

    // @ts-expect-error - web/stream readable stream type error
    const stream = convertArrayToReadableStream(chunks).pipeThrough(transformer);
    const results = await convertAsyncIterableToArray(stream);

    // Only the object chunk should be transformed
    expect(results).toEqual(['{"name":"John"}']);
  });
});
