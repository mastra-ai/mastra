import { describe, it, expect } from 'vitest';
import { ChunkFrom } from '../../types';
import { convertFullStreamChunkToMastra, tryRepairJson } from './transform';
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

    describe('should repair common LLM malformed JSON errors (issue #11078)', () => {
      it('should repair missing quote before property name after comma', () => {
        // Kimi/K2 pattern: {"command":"git diff HEAD",description":"Check changes"}
        // Missing opening quote before "description"
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
          expect(result.payload.args).toEqual({
            command: 'git diff HEAD',
            description: 'Check changes',
          });
        }
      });

      it('should repair unquoted property names', () => {
        // {command:"ls -la", path:"/tmp"}
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: 'call-repair-2',
          toolName: 'run_command',
          input: '{command:"ls -la", path:"/tmp"}',
          providerExecuted: false,
        };

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result).toBeDefined();
        expect(result?.type).toBe('tool-call');
        if (result?.type === 'tool-call') {
          expect(result.payload.args).toEqual({
            command: 'ls -la',
            path: '/tmp',
          });
        }
      });

      it('should repair single quotes used instead of double quotes', () => {
        // {'key':'value','count':42}
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: 'call-repair-3',
          toolName: 'test_tool',
          input: "{'key':'value','count':42}",
          providerExecuted: false,
        };

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result).toBeDefined();
        expect(result?.type).toBe('tool-call');
        if (result?.type === 'tool-call') {
          expect(result.payload.args).toEqual({
            key: 'value',
            count: 42,
          });
        }
      });

      it('should repair trailing commas', () => {
        // {"name":"test","value":123,}
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: 'call-repair-4',
          toolName: 'test_tool',
          input: '{"name":"test","value":123,}',
          providerExecuted: false,
        };

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result).toBeDefined();
        expect(result?.type).toBe('tool-call');
        if (result?.type === 'tool-call') {
          expect(result.payload.args).toEqual({
            name: 'test',
            value: 123,
          });
        }
      });

      it('should repair multiple issues combined', () => {
        // Multiple issues: unquoted key + trailing comma
        // {command:"git status",verbose:true,}
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: 'call-repair-5',
          toolName: 'test_tool',
          input: '{command:"git status",verbose:true,}',
          providerExecuted: false,
        };

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result).toBeDefined();
        expect(result?.type).toBe('tool-call');
        if (result?.type === 'tool-call') {
          expect(result.payload.args).toEqual({
            command: 'git status',
            verbose: true,
          });
        }
      });

      it('should repair trailing comma in nested arrays', () => {
        // {"items":["a","b","c",],"count":3}
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: 'call-repair-6',
          toolName: 'test_tool',
          input: '{"items":["a","b","c",],"count":3}',
          providerExecuted: false,
        };

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result).toBeDefined();
        expect(result?.type).toBe('tool-call');
        if (result?.type === 'tool-call') {
          expect(result.payload.args).toEqual({
            items: ['a', 'b', 'c'],
            count: 3,
          });
        }
      });

      it('should not break valid JSON when repair is attempted', () => {
        // Valid JSON should still parse correctly
        const chunk: StreamPart = {
          type: 'tool-call',
          toolCallId: 'call-valid',
          toolName: 'test_tool',
          input: '{"location":"New York","unit":"celsius","nested":{"key":"value"}}',
          providerExecuted: false,
        };

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result).toBeDefined();
        expect(result?.type).toBe('tool-call');
        if (result?.type === 'tool-call') {
          expect(result.payload.args).toEqual({
            location: 'New York',
            unit: 'celsius',
            nested: { key: 'value' },
          });
        }
      });
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

describe('tryRepairJson', () => {
  it('should return null for completely unrecoverable input', () => {
    expect(tryRepairJson('')).toBeNull();
    expect(tryRepairJson('not json at all')).toBeNull();
    expect(tryRepairJson('{{{')).toBeNull();
    expect(tryRepairJson('undefined')).toBeNull();
  });

  it('should parse valid JSON without modification', () => {
    expect(tryRepairJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryRepairJson('{"key":"value","num":42,"bool":true,"nil":null}')).toEqual({
      key: 'value',
      num: 42,
      bool: true,
      nil: null,
    });
  });

  it('should fix missing opening quote on property name (Kimi/K2 pattern)', () => {
    // {"command":"git diff HEAD",description":"Check changes"}
    expect(tryRepairJson('{"command":"git diff HEAD",description":"Check changes"}')).toEqual({
      command: 'git diff HEAD',
      description: 'Check changes',
    });
  });

  it('should fix multiple missing opening quotes', () => {
    // {"a":"1",b":"2",c":"3"}
    expect(tryRepairJson('{"a":"1",b":"2",c":"3"}')).toEqual({
      a: '1',
      b: '2',
      c: '3',
    });
  });

  it('should fix fully unquoted property names', () => {
    expect(tryRepairJson('{command:"ls",path:"/tmp"}')).toEqual({
      command: 'ls',
      path: '/tmp',
    });
  });

  it('should fix single quotes', () => {
    expect(tryRepairJson("{'key':'value'}")).toEqual({ key: 'value' });
  });

  it('should fix trailing commas in objects', () => {
    expect(tryRepairJson('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
  });

  it('should fix trailing commas in arrays', () => {
    expect(tryRepairJson('{"arr":[1,2,3,]}')).toEqual({ arr: [1, 2, 3] });
  });

  it('should fix deeply nested trailing commas', () => {
    expect(tryRepairJson('{"a":{"b":[1,2,],},}')).toEqual({ a: { b: [1, 2] } });
  });

  it('should fix unquoted keys with boolean and null values', () => {
    expect(tryRepairJson('{flag:true,empty:null,count:0}')).toEqual({
      flag: true,
      empty: null,
      count: 0,
    });
  });

  it('should fix combined: unquoted keys + trailing comma', () => {
    expect(tryRepairJson('{command:"git status",verbose:true,}')).toEqual({
      command: 'git status',
      verbose: true,
    });
  });

  it('should handle whitespace around property names', () => {
    expect(tryRepairJson('{ command : "ls" , path : "/tmp" }')).toEqual({
      command: 'ls',
      path: '/tmp',
    });
  });

  it('should not corrupt apostrophes in double-quoted string values', () => {
    // Trailing comma is the only issue; apostrophe in value must be preserved
    expect(tryRepairJson('{"name": "it\'s a test", "value": 1,}')).toEqual({
      name: "it's a test",
      value: 1,
    });
  });

  it('should not corrupt apostrophes when combined with unquoted keys', () => {
    expect(tryRepairJson('{message:"it\'s working",count:1}')).toEqual({
      message: "it's working",
      count: 1,
    });
  });

  it('should return null for truncated/incomplete JSON (not repairable)', () => {
    expect(tryRepairJson('{"location": "New York", "unit": "cel')).toBeNull();
    expect(tryRepairJson('{"a": {')).toBeNull();
  });
});
