import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import { aiV5ModelMessageToV2PromptMessage } from './to-prompt';

// Mimics Postgres jsonb, which reorders object keys (shorter first, then bytewise).
const jsonbOrder = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(jsonbOrder);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
        .map(k => [k, jsonbOrder((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
};

const toolCallInput = (input: unknown) => {
  const result = aiV5ModelMessageToV2PromptMessage({
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'search', input }],
  });
  return (result.content[0] as { input: unknown }).input;
};

const toolResultOutput = (output: any) => {
  const result = aiV5ModelMessageToV2PromptMessage({
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'search', output }],
  });
  return (result.content[0] as { output: any }).output;
};

describe('aiV5ModelMessageToV2PromptMessage stable tool payload key order', () => {
  it('serializes tool-call input independent of key order, recursing into objects and keeping array order', () => {
    const a = toolCallInput({ query: 'x', limit: 5, filter: { b: 1, a: [{ z: 1, y: 2 }, 3] } });
    const b = toolCallInput({ filter: { a: [{ y: 2, z: 1 }, 3], b: 1 }, limit: 5, query: 'x' });

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe('{"filter":{"a":[{"y":2,"z":1},3],"b":1},"limit":5,"query":"x"}');
  });

  it('serializes json and error-json tool-result values independent of key order', () => {
    for (const type of ['json', 'error-json'] as const) {
      const a = toolResultOutput({ type, value: { source: 'api', forecast: [{ low: 1, high: 2 }] } });
      const b = toolResultOutput({ type, value: { forecast: [{ high: 2, low: 1 }], source: 'api' } });

      expect(a.type).toBe(type);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('leaves text outputs, string inputs and non-plain values untouched', () => {
    const textOutput = { type: 'text', value: 'hello' };
    expect(toolResultOutput(textOutput)).toBe(textOutput);
    expect(toolCallInput('raw-string')).toBe('raw-string');

    const date = new Date(0);
    const bytes = new Uint8Array([1, 2]);
    const input = toolCallInput({ when: date, bytes }) as Record<string, unknown>;
    expect(input.when).toBe(date);
    expect(input.bytes).toBe(bytes);
  });

  it('keeps an own __proto__ key as data', () => {
    const input = toolCallInput(JSON.parse('{"b":1,"__proto__":{"x":1},"a":2}')) as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(input, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
    expect(JSON.stringify(input)).toBe('{"__proto__":{"x":1},"a":2,"b":1}');
  });

  it('does not mutate the source message', () => {
    const original = { query: 'x', limit: 5 };
    toolCallInput(original);

    expect(Object.keys(original)).toEqual(['query', 'limit']);
  });
});

describe('MessageList llmPrompt after a jsonb round-trip (#26828)', () => {
  const buildList = () => {
    const list = new MessageList({ threadId: 'thread-1' });
    list.add({ role: 'user', content: 'What is the weather in Paris?' }, 'input');
    list.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'weather in Paris', limit: 5 },
                result: { forecast: [{ day: 3, high: 21, low: 12 }], source: 'weather-api', cached: false },
              },
            },
          ],
        },
      },
      'response',
    );
    return list;
  };

  const toolPayloads = (prompt: any[]) =>
    prompt
      .flatMap(m => (typeof m.content === 'string' ? [] : m.content))
      .filter((p: any) => p.type === 'tool-call' || p.type === 'tool-result')
      .map((p: any) => JSON.stringify(p.type === 'tool-call' ? p.input : p.output));

  it('produces identical tool payload bytes before and after restoring from jsonb-ordered state', async () => {
    const list = buildList();
    const restored = new MessageList({ threadId: 'thread-1' }).deserialize(
      jsonbOrder(JSON.parse(JSON.stringify(list.serialize()))) as ReturnType<MessageList['serialize']>,
    );

    const before = toolPayloads(await list.get.all.aiV5.llmPrompt());
    const after = toolPayloads(await restored.get.all.aiV5.llmPrompt());
    expect(before).toHaveLength(2);
    expect(after).toEqual(before);

    const beforeV6 = toolPayloads(await list.get.all.aiV6.llmPrompt());
    const afterV6 = toolPayloads(await restored.get.all.aiV6.llmPrompt());
    expect(beforeV6).toHaveLength(2);
    expect(afterV6).toEqual(beforeV6);
  });
});
