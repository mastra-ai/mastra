/**
 * Tests for Datadog exporter utility functions
 */

import { SpanType } from '@mastra/core/observability';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { __setObservabilityFeaturesForTest } from './features';
import { formatInput, formatOutput, getSpanTypeToKind, kindFor, toDate, safeStringify } from './utils';

describe('kindFor', () => {
  describe('with model-inference-span feature (current hierarchy)', () => {
    beforeEach(() => {
      __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
    });
    afterEach(() => {
      __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
    });

    it.each([
      [SpanType.AGENT_RUN, 'agent'],
      [SpanType.MODEL_GENERATION, 'workflow'],
      // MODEL_STEP wraps processors + inference + tool work, so it's a workflow.
      [SpanType.MODEL_STEP, 'workflow'],
      // MODEL_INFERENCE is the actual provider call — the LLM-kind span.
      [SpanType.MODEL_INFERENCE, 'llm'],
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

  describe('legacy hierarchy (older paired @mastra/observability)', () => {
    beforeEach(() => {
      __setObservabilityFeaturesForTest(undefined);
    });
    afterEach(() => {
      __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
    });

    it('keeps MODEL_STEP as the LLM-kind span', () => {
      expect(kindFor(SpanType.MODEL_STEP)).toBe('llm');
    });

    it('does not map MODEL_INFERENCE specially (falls through to task)', () => {
      expect(kindFor(SpanType.MODEL_INFERENCE)).toBe('task');
    });
  });
});

describe('span-type → Datadog kind mapping', () => {
  beforeEach(() => {
    __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
  });
  afterEach(() => {
    __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
  });

  it('maps all SpanType values to a Datadog kind (explicitly or via task fallback)', () => {
    const spanTypes = Object.values(SpanType);
    for (const spanType of spanTypes) {
      const kind = kindFor(spanType);
      expect(kind).toBeDefined();
      expect(['llm', 'agent', 'workflow', 'tool', 'task', 'retrieval', 'embedding']).toContain(kind);
    }
  });

  it('only explicitly maps non-task span types under the current hierarchy', () => {
    const expectedMappings = {
      [SpanType.AGENT_RUN]: 'agent',
      [SpanType.MODEL_GENERATION]: 'workflow',
      [SpanType.MODEL_STEP]: 'workflow',
      [SpanType.MODEL_INFERENCE]: 'llm',
      [SpanType.TOOL_CALL]: 'tool',
      [SpanType.MCP_TOOL_CALL]: 'tool',
      [SpanType.SERVER_TOOL_CALL]: 'tool',
      [SpanType.WORKFLOW_RUN]: 'workflow',
    };

    const active = getSpanTypeToKind();
    expect(Object.keys(active).length).toBe(Object.keys(expectedMappings).length);

    for (const [spanType, expectedKind] of Object.entries(expectedMappings)) {
      expect(active[spanType as SpanType]).toBe(expectedKind);
    }
  });

  it('defaults unmapped types to task', () => {
    const taskTypes = [
      SpanType.MODEL_CHUNK,
      SpanType.WORKFLOW_STEP,
      SpanType.WORKFLOW_CONDITIONAL,
      SpanType.WORKFLOW_CONDITIONAL_EVAL,
      SpanType.WORKFLOW_PARALLEL,
      SpanType.WORKFLOW_LOOP,
      SpanType.WORKFLOW_SLEEP,
      SpanType.WORKFLOW_WAIT_EVENT,
      SpanType.PROCESSOR_RUN,
      SpanType.GENERIC,
    ];

    const active = getSpanTypeToKind();
    for (const spanType of taskTypes) {
      expect(active[spanType]).toBeUndefined();
      expect(kindFor(spanType)).toBe('task');
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

  it('returns an empty string for undefined values', () => {
    expect(safeStringify(undefined)).toBe('');
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

    it('drops empty user messages from message arrays', () => {
      const result = formatInput(
        [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: '' },
          { role: 'user', content: '   ' },
          { role: 'assistant', content: 'What do you need?' },
          { role: 'user', content: 'Hello' },
        ],
        SpanType.MODEL_GENERATION,
      );

      expect(result).toEqual([
        { role: 'system', content: 'You are helpful' },
        { role: 'assistant', content: 'What do you need?' },
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('drops blank string input instead of creating an empty user message', () => {
      const result = formatInput('   ', SpanType.MODEL_GENERATION);

      expect(result).toEqual([]);
    });

    it('drops undefined input instead of throwing during empty message filtering', () => {
      const result = formatInput(undefined, SpanType.MODEL_GENERATION);

      expect(result).toEqual([]);
    });

    it('stringifies object input as user message', () => {
      const result = formatInput({ query: 'search term', filters: { date: '2024' } }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'user', content: '{"query":"search term","filters":{"date":"2024"}}' }]);
    });

    it('normalizes Gemini content array to message format', () => {
      const contents = [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi ' }, { text: 'there!' }] },
      ];
      const result = formatInput(contents, SpanType.MODEL_GENERATION);
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'model', content: 'Hi there!' },
      ]);
    });

    it('unwraps Mastra { messages, schema } input wrapper', () => {
      const input = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        schema: { type: 'object' },
      };
      const result = formatInput(input, SpanType.MODEL_GENERATION);
      expect(result).toEqual([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('unwraps { messages } wrapper for MODEL_STEP spans too', () => {
      const input = {
        messages: [{ role: 'user', content: 'Hi' }],
      };
      const result = formatInput(input, SpanType.MODEL_STEP);
      expect(result).toEqual([{ role: 'user', content: 'Hi' }]);
    });

    it('cleans unwrapped message arrays for MODEL_INFERENCE spans', () => {
      const input = {
        messages: [
          { role: 'user', content: '' },
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = formatInput(input, SpanType.MODEL_INFERENCE);

      expect(result).toEqual([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ]);
    });

    it('unwraps Gemini { contents } request body shape', () => {
      const input = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };
      const result = formatInput(input, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('stringifies multimodal content arrays into the message content field', () => {
      const input = {
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      };
      const result = formatInput(input, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'user', content: '[{"type":"text","text":"hi"}]' }]);
    });

    it('redacts binary data and summarizes tool calls in Gemini parts', () => {
      const contents = [
        {
          role: 'user',
          parts: [
            { text: 'Describe this image: ' },
            { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo...base64...' } },
          ],
        },
        {
          role: 'model',
          parts: [{ functionCall: { name: 'analyze_image', args: { format: 'png' } } }],
        },
      ];
      const result = formatInput(contents, SpanType.MODEL_GENERATION);
      expect(result).toEqual([
        { role: 'user', content: 'Describe this image: [image/png]' },
        { role: 'model', content: '[tool: analyze_image]' },
      ]);
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

    it('preserves structured tool call messages without content', () => {
      const toolCalls = [{ name: 'search', arguments: { q: 'mastra' }, toolId: 'call-1', type: 'function' }];
      const result = formatOutput([{ role: 'assistant', toolCalls }], SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: '', toolCalls }]);
    });

    it('extracts text property from object output', () => {
      const result = formatOutput({ text: 'Hello world', metadata: { model: 'gpt-4' } }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: 'Hello world' }]);
    });

    it('stringifies object output without text property', () => {
      const result = formatOutput({ result: 'success' }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: '{"result":"success"}' }]);
    });

    it('formats tool-call-only outputs as Datadog tool call blocks', () => {
      const result = formatOutput(
        {
          text: '',
          toolCalls: [
            { toolCallId: 'call-1', toolName: 'search', args: { q: 'mastra' } },
            { toolCallId: 'call-2', toolName: 'fetch', input: { url: 'https://mastra.ai' } },
          ],
        },
        SpanType.MODEL_GENERATION,
      );
      expect(result).toEqual([
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { name: 'search', arguments: { q: 'mastra' }, toolId: 'call-1', type: 'function' },
            { name: 'fetch', arguments: { url: 'https://mastra.ai' }, toolId: 'call-2', type: 'function' },
          ],
        },
      ]);
    });

    it('preserves assistant text when formatting Datadog tool call blocks', () => {
      const result = formatOutput(
        {
          text: 'I will search for that.',
          toolCalls: [{ toolCallId: 'call-1', toolName: 'search', args: '{"q":"mastra"}' }],
        },
        SpanType.MODEL_GENERATION,
      );
      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'I will search for that.',
          toolCalls: [{ name: 'search', arguments: { q: 'mastra' }, toolId: 'call-1', type: 'function' }],
        },
      ]);
    });

    it('wraps JSON array and primitive tool-call arguments for Datadog', () => {
      const result = formatOutput(
        {
          text: '',
          toolCalls: [
            { toolCallId: 'call-1', toolName: 'list', args: '[1,2,3]' },
            { toolCallId: 'call-2', toolName: 'literal', args: '"string"' },
          ],
        },
        SpanType.MODEL_GENERATION,
      );
      expect(result).toEqual([
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { name: 'list', arguments: { value: '[1,2,3]' }, toolId: 'call-1', type: 'function' },
            { name: 'literal', arguments: { value: '"string"' }, toolId: 'call-2', type: 'function' },
          ],
        },
      ]);
    });

    it('normalizes null message content to an empty string', () => {
      const result = formatOutput([{ role: 'assistant', content: null }], SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: '' }]);
    });

    it('uses object payload when text is empty and an object result is present', () => {
      const result = formatOutput({ text: '', object: { ok: true } }, SpanType.MODEL_GENERATION);
      expect(result).toEqual([{ role: 'assistant', content: '{"ok":true}' }]);
    });

    it('formats MODEL_INFERENCE output as assistant messages', () => {
      const result = formatOutput('Hi there!', SpanType.MODEL_INFERENCE);
      expect(result).toEqual([{ role: 'assistant', content: 'Hi there!' }]);
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
