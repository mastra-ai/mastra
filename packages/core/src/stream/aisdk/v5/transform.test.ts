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
          parseError: undefined,
          providerExecuted: false,
          providerMetadata: undefined,
        },
      });
    });

    it('should set parseError when JSON is unterminated and unrepairable', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '{"location": "New York", "unit": "cel',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      expect((result as any).payload.toolCallId).toBe('call-1');
      expect((result as any).payload.args).toEqual({});
      expect((result as any).payload.parseError).toContain('malformed JSON');
      expect((result as any).payload.parseError).toContain('get_weather');
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

        const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

        expect(result, `Test case: ${name}`).toBeDefined();
        expect(result?.type, `Test case: ${name}`).toBe('tool-call');
        // Unrepairable JSON should have parseError set
        expect((result as any).payload.parseError, `Test case: ${name}`).toBeDefined();
      });
    });

    it('should set parseError for completely invalid JSON', () => {
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: '{invalid json}',
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      expect((result as any).payload.args).toEqual({});
      expect((result as any).payload.parseError).toContain('malformed JSON');
    });

    it('should truncate long raw input in parseError message', () => {
      const longInput = '{"key": "' + 'A'.repeat(500) + '"}broken';
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'test_tool',
        input: longInput,
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result?.type).toBe('tool-call');
      const parseError = (result as any).payload.parseError as string;
      expect(parseError).toContain('...');
      // The full raw input (500+ chars) should not appear in the message
      expect(parseError).not.toContain(longInput);
    });

    describe('should repair common LLM malformed JSON errors (issue #11078)', () => {
      it('should repair missing quote before property name after comma', () => {
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
        expect((result as any).payload.args).toEqual({
          command: 'git diff HEAD',
          description: 'Check changes',
        });
        expect((result as any).payload.parseError).toBeUndefined();
      });

      it('should repair unquoted property names', () => {
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
        expect((result as any).payload.args).toEqual({
          command: 'ls -la',
          path: '/tmp',
        });
        expect((result as any).payload.parseError).toBeUndefined();
      });

      it('should repair single quotes used instead of double quotes', () => {
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
        expect((result as any).payload.args).toEqual({
          key: 'value',
          count: 42,
        });
        expect((result as any).payload.parseError).toBeUndefined();
      });

      it('should repair trailing commas', () => {
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
        expect((result as any).payload.args).toEqual({
          name: 'test',
          value: 123,
        });
        expect((result as any).payload.parseError).toBeUndefined();
      });

      it('should repair multiple issues combined', () => {
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
        expect((result as any).payload.args).toEqual({
          command: 'git status',
          verbose: true,
        });
        expect((result as any).payload.parseError).toBeUndefined();
      });

      it('should repair trailing comma in nested arrays', () => {
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
        expect((result as any).payload.args).toEqual({
          items: ['a', 'b', 'c'],
          count: 3,
        });
        expect((result as any).payload.parseError).toBeUndefined();
      });

      it('should not break valid JSON when repair is attempted', () => {
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
        expect((result as any).payload.args).toEqual({
          location: 'New York',
          unit: 'celsius',
          nested: { key: 'value' },
        });
        expect((result as any).payload.parseError).toBeUndefined();
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
      expect(result?.type).toBe('tool-call');
      expect((result as any).payload.args).toBeUndefined();
      // Empty input doesn't trigger JSON parsing, so no parseError
      expect((result as any).payload.parseError).toBeUndefined();
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
      expect(result?.type).toBe('tool-call');
      expect((result as any).payload.args).toBeUndefined();
      expect((result as any).payload.parseError).toBeUndefined();
    });

    it('should handle complex nested JSON with long strings - position 871 error simulation from GitHub issue #9958', () => {
      const longString = 'A'.repeat(800);
      const chunk: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'generate_content',
        input: `{"content": "${longString}", "metadata": {"author": "John`,
        providerExecuted: false,
      };

      const result = convertFullStreamChunkToMastra(chunk, { runId: 'test-run-123' });

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      expect((result as any).payload.toolCallId).toBe('call-1');
      expect((result as any).payload.parseError).toContain('malformed JSON');
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
      expect((result as any).payload.stepResult.reason).toBe('stop');
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

  it('should return null for non-object JSON values', () => {
    // Arrays, primitives, and null should not be returned as tool call args
    expect(tryRepairJson('[1,2,3]')).toBeNull();
    expect(tryRepairJson('"just a string"')).toBeNull();
    expect(tryRepairJson('42')).toBeNull();
    expect(tryRepairJson('true')).toBeNull();
    expect(tryRepairJson('null')).toBeNull();
  });

  it('should return null for arrays with trailing commas (non-object result)', () => {
    // Even if repair succeeds, arrays should not be returned
    expect(tryRepairJson('[1,2,3,]')).toBeNull();
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
    expect(tryRepairJson('{"command":"git diff HEAD",description":"Check changes"}')).toEqual({
      command: 'git diff HEAD',
      description: 'Check changes',
    });
  });

  it('should fix multiple missing opening quotes', () => {
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

  it('should preserve apostrophes inside double-quoted values when single-quoted keys are present', () => {
    // Single-quoted keys + apostrophe in a double-quoted value
    // {'name': "it's a test", 'value': 1}
    expect(tryRepairJson("{  'name': \"it's a test\", 'value': 1}")).toEqual({
      name: "it's a test",
      value: 1,
    });
  });

  it('should handle mixed single and double quotes correctly', () => {
    // Some keys single-quoted, some double-quoted
    expect(tryRepairJson("{\"name\": 'hello', 'count': 42}")).toEqual({
      name: 'hello',
      count: 42,
    });
  });

  it('should escape double quotes inside single-quoted strings', () => {
    // Single-quoted value containing a double quote: {'key': 'say "hi"'}
    expect(tryRepairJson("{'key': 'say \"hi\"'}")).toEqual({
      key: 'say "hi"',
    });
  });

  it('should return null for truncated/incomplete JSON (not repairable)', () => {
    expect(tryRepairJson('{"location": "New York", "unit": "cel')).toBeNull();
    expect(tryRepairJson('{"a": {')).toBeNull();
  });
});
