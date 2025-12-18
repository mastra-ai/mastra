/**
 * Tests for Datadog exporter utility functions
 */

import { describe, it, expect } from 'vitest';
import { SpanType } from '@mastra/core/observability';
import { formatInput, formatOutput, kindFor, toDate, safeStringify, SPAN_TYPE_TO_KIND } from './utils';

describe('kindFor', () => {
  it.each([
    [SpanType.AGENT_RUN, 'agent'],
    [SpanType.MODEL_GENERATION, 'llm'],
    [SpanType.MODEL_STEP, 'llm'],
    [SpanType.MODEL_CHUNK, 'task'],
    [SpanType.TOOL_CALL, 'tool'],
    [SpanType.MCP_TOOL_CALL, 'tool'],
    [SpanType.WORKFLOW_RUN, 'workflow'],
    [SpanType.WORKFLOW_STEP, 'task'],
    [SpanType.WORKFLOW_CONDITIONAL, 'task'],
    [SpanType.WORKFLOW_CONDITIONAL_EVAL, 'task'],
    [SpanType.WORKFLOW_PARALLEL, 'task'],
    [SpanType.WORKFLOW_LOOP, 'task'],
    [SpanType.WORKFLOW_SLEEP, 'task'],
    [SpanType.WORKFLOW_WAIT_EVENT, 'task'],
    [SpanType.PROCESSOR_RUN, 'task'],
    [SpanType.GENERIC, 'task'],
  ])('maps %s to %s kind', (spanType, expectedKind) => {
    expect(kindFor(spanType)).toBe(expectedKind);
  });

  it('returns task for unknown span types', () => {
    expect(kindFor('unknown_type' as SpanType)).toBe('task');
  });
});

describe('SPAN_TYPE_TO_KIND mapping', () => {
  it('has a mapping for all SpanType values', () => {
    const spanTypes = Object.values(SpanType);
    for (const spanType of spanTypes) {
      expect(SPAN_TYPE_TO_KIND[spanType]).toBeDefined();
    }
  });
});

describe('toDate', () => {
  it('returns Date objects unchanged', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    expect(toDate(date)).toBe(date);
  });

  it('converts string to Date', () => {
    const result = toDate('2024-01-01T00:00:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('converts number (timestamp) to Date', () => {
    const timestamp = 1704067200000; // 2024-01-01T00:00:00Z
    const result = toDate(timestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(timestamp);
  });
});

describe('safeStringify', () => {
  it('stringifies simple objects', () => {
    expect(safeStringify({ a: 1, b: 'test' })).toBe('{"a":1,"b":"test"}');
  });

  it('stringifies arrays', () => {
    expect(safeStringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('handles circular references gracefully', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const result = safeStringify(obj);
    expect(result).toContain('Non-serializable');
  });

  it('returns string representation for primitives', () => {
    expect(safeStringify('hello')).toBe('"hello"');
    expect(safeStringify(123)).toBe('123');
  });
});

describe('formatInput', () => {
  describe('LLM spans (MODEL_GENERATION)', () => {
    it('formats string input as user message array', () => {
      const result = formatInput('Hello, world!', SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'user', content: 'Hello, world!' }]);
    });

    it('preserves existing message array format', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];
      const result = formatInput(messages, SpanType.MODEL_GENERATION);
      expect(result).toEqual(messages);
    });

    it('stringifies object input as user message', () => {
      const result = formatInput({ query: 'search term', filters: { date: '2024' } }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'user', content: '{"query":"search term","filters":{"date":"2024"}}' }]);
    });
  });

  describe('non-LLM spans (TOOL_CALL)', () => {
    it('passes through string input', () => {
      const result = formatInput('raw input', SpanType.TOOL_CALL);
      expect(result).toBe('raw input');
    });

    it('passes through array input', () => {
      const input = ['a', 'b', 'c'];
      const result = formatInput(input, SpanType.TOOL_CALL);
      expect(result).toBe(input);
    });

    it('stringifies object input', () => {
      const result = formatInput({ query: 'search term' }, SpanType.TOOL_CALL);
      expect(result).toBe('{"query":"search term"}');
    });
  });
});

describe('formatOutput', () => {
  describe('LLM spans (MODEL_GENERATION)', () => {
    it('formats string output as assistant message array', () => {
      const result = formatOutput('Hi there!', SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: 'Hi there!' }]);
    });

    it('preserves existing message array format', () => {
      const messages = [{ role: 'assistant', content: 'Hello!' }];
      const result = formatOutput(messages, SpanType.MODEL_GENERATION);
      expect(result).toEqual(messages);
    });

    it('extracts text property from object output', () => {
      const result = formatOutput({ text: 'Hello world', metadata: { model: 'gpt-4' } }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: 'Hello world' }]);
    });

    it('stringifies object output without text property', () => {
      const result = formatOutput({ result: 'success' }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: '{"result":"success"}' }]);
    });
  });

  describe('non-LLM spans (TOOL_CALL)', () => {
    it('passes through string output', () => {
      const result = formatOutput('result', SpanType.TOOL_CALL);
      expect(result).toBe('result');
    });

    it('stringifies object output', () => {
      const result = formatOutput({ results: ['a', 'b'] }, SpanType.TOOL_CALL);
      expect(result).toBe('{"results":["a","b"]}');
    });
  });
});
