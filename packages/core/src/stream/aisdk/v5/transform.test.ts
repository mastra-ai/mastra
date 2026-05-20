import { describe, it, expect, vi } from 'vitest';
import { ChunkFrom } from '../../types';
import { convertFullStreamChunkToMastra, sanitizeToolCallInput, tryRepairJson } from './transform';
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

    it('should recover valid JSON with trailing <|call|> token', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '{}<|call|>',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({});
      }
    });

    it('should recover valid JSON with tab + <|call|> token (issue #13185)', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'checkpoint',
        input: '{\n"checkpointNumber": 1,\n"vehicleType": "leopard"\n}\t<|call|>',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ checkpointNumber: 1, vehicleType: 'leopard' });
      }
    });

    it('should recover valid JSON with <|endoftext|> token', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-3',
        toolName: 'search',
        input: '{"query": "hello world"}<|endoftext|>',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ query: 'hello world' });
      }
    });

    it('should gracefully return undefined for truly malformed JSON (issue #13261)', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-4',
        toolName: 'checkpoint',
        input: '{"vehicleType":"leopard","checkpointNumber":?}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toBeUndefined();
      }
    });

    it('should repair JSON with missing quote before property name (issue #11078)', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-repair-1',
        toolName: 'run_command',
        input: '{"command":"git diff HEAD",description":"Check changes"}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ command: 'git diff HEAD', description: 'Check changes' });
      }
    });

    it('should repair JSON with unquoted property names', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-repair-2',
        toolName: 'run_command',
        input: '{command:"ls -la",path:"/tmp"}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ command: 'ls -la', path: '/tmp' });
      }
    });

    it('should repair JSON with single quotes', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-repair-3',
        toolName: 'search',
        input: "{'query':'hello world','limit':10}",
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ query: 'hello world', limit: 10 });
      }
    });

    it('should repair JSON with unquoted date values in tool args (issue #14230)', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-repair-dates',
        toolName: 'edit_milestone',
        input: '{"milestoneId": "abc123", "name": "Sprint 1", "dueStart": 2026-04-15, "dueEnd": 2026-06-30}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({
          milestoneId: 'abc123',
          name: 'Sprint 1',
          dueStart: '2026-04-15',
          dueEnd: '2026-06-30',
        });
      }
    });

    it('should repair JSON with trailing commas', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-repair-4',
        toolName: 'create_item',
        input: '{"name":"test","value":42,}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ name: 'test', value: 42 });
      }
    });

    it('should preserve <|...|> patterns inside JSON string values in tool-call args', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-5',
        toolName: 'process_text',
        input: '{"text": "The <|endoftext|> token marks boundaries"}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toEqual({ text: 'The <|endoftext|> token marks boundaries' });
      }
    });

    it('should return undefined args without console.error noise when input is purely LLM tokens', () => {
      const errorSpy = vi.spyOn(console, 'error');
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-6',
        toolName: 'noop',
        input: '<|call|>',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });
      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      if (result?.type === 'tool-call') {
        expect(result.payload.args).toBeUndefined();
      }
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('sanitizeToolCallInput', () => {
    it('should strip <|call|> token from valid JSON', () => {
      expect(sanitizeToolCallInput('{}<|call|>')).toBe('{}');
    });

    it('should strip <|endoftext|> token', () => {
      expect(sanitizeToolCallInput('{"a":1}<|endoftext|>')).toBe('{"a":1}');
    });

    it('should strip multiple tokens', () => {
      expect(sanitizeToolCallInput('{}<|call|><|endoftext|>')).toBe('{}');
    });

    it('should strip tab + token combinations', () => {
      expect(sanitizeToolCallInput('{}\t<|call|>')).toBe('{}');
    });

    it('should be a no-op on clean JSON', () => {
      expect(sanitizeToolCallInput('{"key": "value"}')).toBe('{"key": "value"}');
    });

    it('should handle empty string', () => {
      expect(sanitizeToolCallInput('')).toBe('');
    });

    it('should strip <|end|> token', () => {
      expect(sanitizeToolCallInput('{"x":1}<|end|>')).toBe('{"x":1}');
    });

    it('should strip tokens with surrounding whitespace', () => {
      expect(sanitizeToolCallInput('{"x":1}  <|call|>  ')).toBe('{"x":1}');
    });

    it('should preserve <|...|> patterns inside JSON string values', () => {
      const input = '{"text": "use <|call|> token"}';
      expect(sanitizeToolCallInput(input)).toBe('{"text": "use <|call|> token"}');
    });

    it('should preserve multiple <|...|> patterns inside JSON string values', () => {
      const input = '{"prompt": "tokens: <|endoftext|> and <|call|> are special"}';
      expect(sanitizeToolCallInput(input)).toBe('{"prompt": "tokens: <|endoftext|> and <|call|> are special"}');
    });
  });

  describe('tryRepairJson', () => {
    it('should fix missing quote before property name', () => {
      // e.g. {"command":"git diff HEAD",description":"Check changes"}
      const result = tryRepairJson('{"command":"git diff HEAD",description":"Check changes"}');
      expect(result).toEqual({ command: 'git diff HEAD', description: 'Check changes' });
    });

    it('should fix unquoted property names', () => {
      const result = tryRepairJson('{command:"ls",path:"/tmp"}');
      expect(result).toEqual({ command: 'ls', path: '/tmp' });
    });

    it('should fix single quotes', () => {
      const result = tryRepairJson("{'key':'value','num':42}");
      expect(result).toEqual({ key: 'value', num: 42 });
    });

    it('should fix trailing commas', () => {
      const result = tryRepairJson('{"a":1,"b":2,}');
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should fix trailing comma in array', () => {
      const result = tryRepairJson('{"items":["a","b",]}');
      expect(result).toEqual({ items: ['a', 'b'] });
    });

    it('should handle multiple issues at once', () => {
      // Unquoted keys + trailing comma
      const result = tryRepairJson("{command:'ls',path:'/tmp',}");
      expect(result).toEqual({ command: 'ls', path: '/tmp' });
    });

    it('should return null for unrecoverable JSON', () => {
      expect(tryRepairJson('not json at all')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(tryRepairJson('')).toBeNull();
    });

    it('should handle already-valid JSON', () => {
      const result = tryRepairJson('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should fix missing quote with nested objects', () => {
      const result = tryRepairJson('{"outer":"val",inner":{"a":1}}');
      expect(result).toEqual({ outer: 'val', inner: { a: 1 } });
    });

    it('should fix property names with $ prefix', () => {
      const result = tryRepairJson('{$ref:"#/definitions/foo"}');
      expect(result).toEqual({ $ref: '#/definitions/foo' });
    });

    it('should fix property names with _ prefix', () => {
      const result = tryRepairJson('{_id:"123",_type:"user"}');
      expect(result).toEqual({ _id: '123', _type: 'user' });
    });

    it('should quote unquoted date values like YYYY-MM-DD (issue #14230)', () => {
      const result = tryRepairJson(
        '{"milestoneId": "abc123", "name": "Sprint 1", "dueStart": 2026-04-15, "dueEnd": 2026-06-30}',
      );
      expect(result).toEqual({
        milestoneId: 'abc123',
        name: 'Sprint 1',
        dueStart: '2026-04-15',
        dueEnd: '2026-06-30',
      });
    });

    it('should quote unquoted date value before closing brace (issue #14230)', () => {
      const result = tryRepairJson('{"date": 2026-04-15}');
      expect(result).toEqual({ date: '2026-04-15' });
    });

    it('should quote unquoted datetime values with time component (issue #14230)', () => {
      const result = tryRepairJson('{"start": 2026-04-15T09:00:00, "end": 2026-04-15T17:00:00}');
      expect(result).toEqual({
        start: '2026-04-15T09:00:00',
        end: '2026-04-15T17:00:00',
      });
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
          cacheCreationInputTokens: 7,
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
        expect(result.payload.output.usage.cacheCreationInputTokens).toBe(7);
        expect(result.payload.providerMetadata).toEqual({});
        expect(result.payload.metadata.providerMetadata).toEqual({});
      }
    });

    it('should preserve providerMetadata for AI SDK v6 finish chunks', () => {
      const providerMetadata = {
        anthropic: {
          cacheReadInputTokens: 94,
          cacheCreationInputTokens: 6,
        },
      };
      const chunk: StreamPart = {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'end_turn' },
        usage: {
          inputTokens: { total: 100, noCache: 6, cacheRead: 94, cacheWrite: 6 },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        providerMetadata,
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
        expect(result.payload.output.usage.cachedInputTokens).toBe(94);
        expect(result.payload.output.usage.cacheCreationInputTokens).toBe(6);
        expect(result.payload.providerMetadata).toEqual(providerMetadata);
        expect(result.payload.metadata.providerMetadata).toEqual(providerMetadata);
      }
    });

    it('should preserve Google/Gemini providerMetadata for finish chunks', () => {
      const providerMetadata = {
        google: {
          usageMetadata: {
            cachedContentTokenCount: 150,
            thoughtsTokenCount: 250,
          },
          groundingMetadata: {
            webSearchQueries: ['mastra ai'],
          },
        },
      };
      const chunk: StreamPart = {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 200, noCache: 50, cacheRead: 150 },
          outputTokens: { total: 400, text: 150, reasoning: 250 },
        },
        providerMetadata,
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
        expect(result.payload.output.usage.cachedInputTokens).toBe(150);
        expect(result.payload.output.usage.reasoningTokens).toBe(250);
        expect(result.payload.providerMetadata).toEqual(providerMetadata);
        expect(result.payload.metadata.providerMetadata).toEqual(providerMetadata);
      }
    });
  });
});
