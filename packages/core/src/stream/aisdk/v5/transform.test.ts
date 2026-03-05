import { describe, it, expect } from 'vitest';
import { ChunkFrom } from '../../types';
import { convertFullStreamChunkToMastra, parseToolCallInput, stripTrailingLLMTokens } from './transform';
import type { StreamPart } from './transform';

describe('convertFullStreamChunkToMastra', () => {
  describe('tool-call handling', () => {
    it('should parse valid JSON input', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '{"location": "New York", "unit": "celsius"}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toEqual({
        type: 'tool-call',
        runId: 'test-run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'get_weather',
          args: { location: 'New York', unit: 'celsius' },
          providerExecuted: false,
          providerMetadata: undefined,
        },
      });
    });

    it('should gracefully handle unterminated JSON string in input - simulating streaming race condition', () => {
      // This simulates when a tool-call chunk arrives with partial JSON
      // BUG: Currently this throws "Unterminated string in JSON" error
      // EXPECTED: Should handle gracefully without crashing
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '{"location": "New York", "unit": "cel',
        providerExecuted: false,
      };

      // Should NOT throw - should handle gracefully
      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      // When JSON is incomplete, we should either:
      // 1. Return undefined args, or
      // 2. Return the raw string for later processing
      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');

      if (result?.type === 'tool-call') {
        expect(result?.payload.toolCallId).toBe('call-1');
        // Args should be undefined or the raw string, not throw
        expect(() => result?.payload.args).not.toThrow();
      }
    });

    it('should handle unterminated JSON at different positions without throwing', () => {
      const testCases = [
        {
          name: 'unterminated at string start',
          input: '{"location": "New',
          toolName: 'test_tool_1',
        },
        {
          name: 'unterminated with nested object',
          input: '{"location": "New York", "details": {"temp',
          toolName: 'test_tool_2',
        },
        {
          name: 'unterminated in array',
          input: '{"locations": ["New York", "San',
          toolName: 'test_tool_3',
        },
        {
          name: 'missing closing brace',
          input: '{"location": "New York"',
          toolName: 'test_tool_4',
        },
        {
          name: 'unterminated with escape sequences',
          input: '{"message": "Hello\\nWor',
          toolName: 'test_tool_5',
        },
      ];

      testCases.forEach(({ name, input, toolName }) => {
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: `call-${toolName}`,
          toolName,
          input,
          providerExecuted: false,
        };

        // Should NOT throw - should handle gracefully
        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result, `Test case: ${name}`).toBeDefined();
        expect(result?.type, `Test case: ${name}`).toBe('tool-call');
      });
    });

    it('should handle malformed JSON without crashing', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '{invalid json}',
        providerExecuted: false,
      };

      // Should handle gracefully, not throw
      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
    });

    it('should handle empty input string', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      if (result?.type === 'tool-call') {
        expect(result.payload).toHaveProperty('args', undefined);
      }
    });

    it('should handle undefined input', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        // @ts-expect-error - testing undefined input
        input: undefined,
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      if (result?.type === 'tool-call') {
        expect(result.payload).toHaveProperty('args', undefined);
      }
    });

    it('should handle complex nested JSON with long strings - position 871 error simulation from GitHub issue #9958', () => {
      // The original error from issue #9958 shows "position 871 (line 5 column 41)"
      // This simulates a larger JSON payload that gets cut off at a similar position
      // This is the EXACT scenario reported by users
      const longString = 'A'.repeat(800);
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'generate_content',
        // Cut the string in the middle of a value to simulate the unterminated string
        input: `{"content": "${longString}", "metadata": {"author": "John`,
        providerExecuted: false,
      };

      // Should NOT throw - should handle gracefully
      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result?.payload.toolCallId).toBe('call-1');
      } else {
        throw new Error('Result is not a tool-call');
      }
    });
  });

  describe('malformed tool-call arguments from OpenRouter (issue #13261)', () => {
    it('should recover JSON with ? placeholder values by replacing with null', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'check_vehicle',
        input: '{"vehicleType":"leopard","checkpointNumber":?}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ vehicleType: 'leopard', checkpointNumber: null });
      }
    });

    it('should recover JSON with ? in the middle of an object', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'test_tool',
        input: '{"a":?,"b":"hello"}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ a: null, b: 'hello' });
      }
    });

    it('should recover JSON with ? in an array', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'test_tool',
        input: '{"items":[?]}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ items: [null] });
      }
    });

    it('should handle trailing LLM tokens combined with malformed JSON', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'test_tool',
        input: '{"a":1}<|call|>',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ a: 1 });
      }
    });
  });

  describe('other chunk types', () => {
    it('should handle text-delta chunks correctly', () => {
      const chunk: StreamPart = {
        type: 'text-delta',
        id: 'text-1',
        delta: 'Hello',
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toEqual({
        type: 'text-delta',
        runId: 'test-run-123',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'text-1',
          providerMetadata: undefined,
          text: 'Hello',
        },
      });
    });

    it('should handle finish chunks correctly', () => {
      const chunk: StreamPart = {
        type: 'finish',
        finishReason: 'stop',
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
        providerMetadata: {},
        messages: {
          all: [],
          user: [],
          nonUser: [],
        },
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result?.type).toBe('finish');
      if (result?.type === 'finish') {
        expect(result.payload.stepResult.reason).toBe('stop');
      }
    });
  });
});

describe('parseToolCallInput', () => {
  it('should parse valid JSON', () => {
    expect(parseToolCallInput('{"a":1}')).toEqual({ a: 1 });
  });

  it('should return undefined for empty string', () => {
    expect(parseToolCallInput('')).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(parseToolCallInput(null)).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(parseToolCallInput(undefined)).toBeUndefined();
  });

  it('should return undefined for non-string input', () => {
    expect(parseToolCallInput(42)).toBeUndefined();
    expect(parseToolCallInput({})).toBeUndefined();
  });

  it('should strip trailing LLM tokens and parse', () => {
    expect(parseToolCallInput('{"a":1}<|call|>')).toEqual({ a: 1 });
    expect(parseToolCallInput('{"a":1}  <|endoftext|>  ')).toEqual({ a: 1 });
    expect(parseToolCallInput('{"a":1}\t<|call|>')).toEqual({ a: 1 });
  });

  it('should replace ? placeholder values with null', () => {
    expect(parseToolCallInput('{"checkpointNumber":?}')).toEqual({ checkpointNumber: null });
    expect(parseToolCallInput('{"a":?,"b":"hello"}')).toEqual({ a: null, b: 'hello' });
  });

  it('should handle combined trailing tokens and ? placeholders', () => {
    expect(parseToolCallInput('{"a":?}<|call|>')).toEqual({ a: null });
  });

  it('should return undefined for completely unparseable input', () => {
    expect(parseToolCallInput('{totally broken')).toBeUndefined();
  });

  it('should not modify valid JSON with ? inside string values', () => {
    expect(parseToolCallInput('{"q":"what?"}')).toEqual({ q: 'what?' });
  });
});

describe('stripTrailingLLMTokens', () => {
  it('should strip a single trailing token', () => {
    expect(stripTrailingLLMTokens('{"a":1}<|call|>')).toBe('{"a":1}');
  });

  it('should strip multiple trailing tokens', () => {
    expect(stripTrailingLLMTokens('{"a":1}<|call|><|endoftext|>')).toBe('{"a":1}');
  });

  it('should strip tokens with surrounding whitespace', () => {
    expect(stripTrailingLLMTokens('{"a":1}  <|call|>  ')).toBe('{"a":1}');
  });

  it('should not strip tokens inside JSON string values', () => {
    expect(stripTrailingLLMTokens('{"prompt": "Use <|system|> token"}')).toBe('{"prompt": "Use <|system|> token"}');
  });

  it('should not strip leading tokens', () => {
    expect(stripTrailingLLMTokens('<|im_start|>{"a":1}')).toBe('<|im_start|>{"a":1}');
  });

  it('should return input unchanged when no tokens present', () => {
    expect(stripTrailingLLMTokens('{"a":1}')).toBe('{"a":1}');
  });

  it('should handle empty string', () => {
    expect(stripTrailingLLMTokens('')).toBe('');
  });
});
