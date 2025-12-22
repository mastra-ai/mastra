import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { AgentRunFormatter } from './agent-run-formatter';

// Helper to create a mock span
function createMockSpan(overrides: { type?: SpanType; input?: unknown; output?: unknown }) {
  return {
    id: 'test-span-1',
    name: 'test-span',
    type: overrides.type ?? SpanType.AGENT_RUN,
    startTime: new Date(),
    traceId: 'trace-123',
    attributes: {},
    input: overrides.input,
    output: overrides.output,
    observabilityInstance: {} as any,
    end: () => {},
    error: () => {},
    update: () => {},
    createChildSpan: () => ({}) as any,
  } as any;
}

describe('AgentRunFormatter', () => {
  describe('process', () => {
    it('should return undefined for undefined span', () => {
      const processor = new AgentRunFormatter();
      expect(processor.process(undefined)).toBeUndefined();
    });

    it('should return non-AGENT_RUN spans unchanged', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        type: SpanType.MODEL_GENERATION,
        output: { text: 'Hello', object: undefined, files: [] },
      });

      const result = processor.process(span);

      expect(result?.output).toEqual({ text: 'Hello', object: undefined, files: [] });
    });

    it('should extract single non-empty property from output', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: { text: 'Hello world', object: undefined, files: [] },
      });

      const result = processor.process(span);

      expect(result?.output).toBe('Hello world');
    });

    it('should extract content from single user message input', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: { messages: [{ role: 'user', content: 'Hello there' }] },
      });

      const result = processor.process(span);

      expect(result?.input).toBe('Hello there');
    });

    it('should not transform input with multiple messages', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: {
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello' },
          ],
        },
      });

      const result = processor.process(span);

      expect(result?.input).toEqual({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
        ],
      });
    });

    it('should not transform input with single non-user message', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: { messages: [{ role: 'system', content: 'You are helpful' }] },
      });

      const result = processor.process(span);

      expect(result?.input).toEqual({ messages: [{ role: 'system', content: 'You are helpful' }] });
    });

    it('should not transform input without messages property', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: { data: 'some data' },
      });

      const result = processor.process(span);

      expect(result?.input).toEqual({ data: 'some data' });
    });

    it('should not transform when multiple non-empty properties exist', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: { text: 'Hello', object: { foo: 1 }, files: [] },
      });

      const result = processor.process(span);

      expect(result?.output).toEqual({ text: 'Hello', object: { foo: 1 }, files: [] });
    });

    it('should not transform when all properties are empty', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: { text: undefined, object: null, files: [] },
      });

      const result = processor.process(span);

      expect(result?.output).toEqual({ text: undefined, object: null, files: [] });
    });

    it('should not transform output arrays', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: [{ id: 1 }, { id: 2 }],
      });

      const result = processor.process(span);

      expect(result?.output).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should not transform array input (not object with messages)', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: [{ role: 'user', content: 'Hi' }],
      });

      const result = processor.process(span);

      expect(result?.input).toEqual([{ role: 'user', content: 'Hi' }]);
    });

    it('should not transform primitive values', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: 'just a string',
        output: 42,
      });

      const result = processor.process(span);

      expect(result?.input).toBe('just a string');
      expect(result?.output).toBe(42);
    });

    it('should not transform null or undefined', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        input: null,
        output: undefined,
      });

      const result = processor.process(span);

      expect(result?.input).toBeNull();
      expect(result?.output).toBeUndefined();
    });

    it('should treat empty string as empty value', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: { text: '', object: { foo: 1 }, files: [] },
      });

      const result = processor.process(span);

      // Only object is non-empty, so extract it
      expect(result?.output).toEqual({ foo: 1 });
    });

    it('should treat empty array as empty value', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: { text: 'Hello', files: [] },
      });

      const result = processor.process(span);

      // Only text is non-empty, so extract it
      expect(result?.output).toBe('Hello');
    });

    it('should treat non-empty array as non-empty value', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: { text: undefined, files: [{ name: 'doc.pdf' }] },
      });

      const result = processor.process(span);

      // Only files is non-empty, so extract it
      expect(result?.output).toEqual([{ name: 'doc.pdf' }]);
    });

    it('should handle nested objects as single value', () => {
      const processor = new AgentRunFormatter();

      const span = createMockSpan({
        output: {
          text: undefined,
          object: { nested: { deep: 'value' } },
          files: [],
        },
      });

      const result = processor.process(span);

      expect(result?.output).toEqual({ nested: { deep: 'value' } });
    });
  });

  describe('shutdown', () => {
    it('should resolve without error', async () => {
      const processor = new AgentRunFormatter();
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('name', () => {
    it('should have correct name', () => {
      const processor = new AgentRunFormatter();
      expect(processor.name).toBe('agent-run-formatter');
    });
  });
});
