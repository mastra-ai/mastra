import { convertArrayToReadableStream, convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { asSchema } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import z3 from 'zod/v3';
import z4 from 'zod/v4';
import type { ChunkType } from '../types';
import { ChunkFrom } from '../types';
import { createObjectStreamTransformer, escapeUnescapedControlCharsInJsonStrings } from './output-format-handlers';

describe('escapeUnescapedControlCharsInJsonStrings', () => {
  it('should escape newlines inside JSON strings', () => {
    const input = '{"message": "Hello\nWorld"}';
    const expected = '{"message": "Hello\\nWorld"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should escape carriage returns inside JSON strings', () => {
    const input = '{"message": "Hello\rWorld"}';
    const expected = '{"message": "Hello\\rWorld"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should escape tabs inside JSON strings', () => {
    const input = '{"message": "Hello\tWorld"}';
    const expected = '{"message": "Hello\\tWorld"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should not escape newlines outside JSON strings', () => {
    const input = '{\n  "message": "Hello"\n}';
    const expected = '{\n  "message": "Hello"\n}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should preserve already-escaped sequences', () => {
    const input = '{"message": "Hello\\nWorld"}';
    const expected = '{"message": "Hello\\nWorld"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle escaped quotes inside strings', () => {
    const input = '{"message": "He said \\"Hello\nWorld\\""}';
    const expected = '{"message": "He said \\"Hello\\nWorld\\""}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle multiple strings with mixed newlines', () => {
    const input = '{"a": "line1\nline2", "b": "line3\nline4"}';
    const expected = '{"a": "line1\\nline2", "b": "line3\\nline4"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle complex nested JSON with newlines in strings', () => {
    const input = `{"outer": {"inner": "value with
newline"}, "array": ["item1
continued", "item2"]}`;
    const expected = '{"outer": {"inner": "value with\\nnewline"}, "array": ["item1\\ncontinued", "item2"]}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle empty strings', () => {
    const input = '{"message": ""}';
    const expected = '{"message": ""}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle string with only newline', () => {
    const input = '{"message": "\n"}';
    const expected = '{"message": "\\n"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle CRLF sequences', () => {
    const input = '{"message": "Hello\r\nWorld"}';
    const expected = '{"message": "Hello\\r\\nWorld"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle partial/incomplete JSON (streaming scenario)', () => {
    // During streaming, we might have incomplete JSON
    const input = '{"message": "Hello\nWor';
    const expected = '{"message": "Hello\\nWor';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });

  it('should handle backslash at end of string', () => {
    const input = '{"path": "C:\\\\"}';
    const expected = '{"path": "C:\\\\"}';
    expect(escapeUnescapedControlCharsInJsonStrings(input)).toBe(expected);
  });
});

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
        structuredOutput: { schema },
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
        structuredOutput: { schema },
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
        structuredOutput: { schema },
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
          payload: { id: 'text-1', text: '{"result":"yellow"}' },
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
          payload: { id: 'text-1', text: '{"name":"Alice","count":5}' },
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
          payload: { id: 'text-1', text: '{"id":"abc","value":42}' },
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
          payload: { id: 'text-1', text: '{"title":"Product","price":29.99}' },
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
          payload: { id: 'text-1', text: '{"id":123}' },
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

  describe('unescaped newlines in JSON strings', () => {
    it('should handle LLM output with actual newlines in string values instead of \\n escape sequences', async () => {
      // This test reproduces the issue where LLMs output actual newlines in JSON strings
      // instead of properly escaped \n sequences, breaking JSON parsing
      //
      // User report: "Line breaks aren't being properly escaped: instead of getting \n
      // in my strings, I'm getting actual newline characters that completely break
      // the JSON object structure."
      const schema = z.object({
        fieldId: z.string(),
        content: z.string(),
        summary: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
      });

      // Simulates LLM outputting actual newlines instead of \n escape sequences
      // This is invalid JSON but commonly produced by LLMs
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
      // More realistic scenario: newlines appear across multiple streaming chunks
      const schema = z.object({
        notes: z.string(),
        recommendation: z.string(),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema },
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

    it('should handle interview transcript extraction with paragraph fields containing newlines', async () => {
      // Reproduces the exact user scenario: interview transcription with paragraph fields
      const noteFillerOutputSchema = z.object({
        field_experience: z.string().describe('Previous work experience'),
        field_skills: z.string().describe('Technical skills'),
        field_motivation: z.string().describe('Motivation for the role'),
      });

      const transformer = createObjectStreamTransformer({
        structuredOutput: { schema: noteFillerOutputSchema },
      });

      // This is what the LLM might output - actual newlines instead of \n
      const llmOutput = `{"field_experience": "Worked at Company A for 3 years
Key responsibilities:
- Led team of 5 engineers
- Delivered 3 major projects", "field_skills": "Languages:
- Python
- JavaScript
- Go

Frameworks:
- React
- Django", "field_motivation": "Looking for growth opportunities
Want to work on challenging problems"}`;

      const streamParts: ChunkType<typeof noteFillerOutputSchema>[] = [
        {
          type: 'text-delta',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: llmOutput },
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

      // The content should be preserved with the newlines
      expect(objectResultChunk?.object?.field_experience).toContain('Key responsibilities:');
      expect(objectResultChunk?.object?.field_skills).toContain('Languages:');
      expect(objectResultChunk?.object?.field_motivation).toContain('Looking for growth opportunities');

      const errorChunk = chunks.find(c => c?.type === 'error');
      expect(errorChunk).toBeUndefined();
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
