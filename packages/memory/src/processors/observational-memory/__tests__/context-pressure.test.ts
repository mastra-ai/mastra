import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { contextPressure, countToolDefinitions, snapshotContextRequest } from '../context-pressure';
import { TokenCounter } from '../token-counter';

const counter = new TokenCounter();
function snapshot(messages: MastraDBMessage[], step = 0, model = 'provider/model') {
  const list = new MessageList();
  list.add(messages, 'memory');
  return snapshotContextRequest(list, step, model, counter);
}
const message: MastraDBMessage = {
  id: 'request',
  role: 'user',
  createdAt: new Date(0),
  content: { format: 2, parts: [{ type: 'text', text: 'Read the file.' }] },
};
const anchor = { request: snapshot([message]), inputTokens: 10_000, outputTokens: 2_000, outputEstimate: 100 };

describe('context usage anchors', () => {
  it('does not count tagged system messages (OM observations) or tool definitions as message pressure', () => {
    const observations = 'Observed: '.concat('the user prefers short answers. '.repeat(400));
    const withObservations = (step: number, toolTokens = 0) => {
      const list = new MessageList();
      list.add([message], 'memory');
      list.addSystem({ role: 'system', content: observations }, 'observational-memory');
      return snapshotContextRequest(list, step, 'provider/model', counter, toolTokens);
    };
    const tools = {
      read: { description: 'Read a file', inputSchema: z.object({ path: z.string().describe('File path') }) },
    };
    const toolTokens = countToolDefinitions(tools, counter);
    expect(toolTokens).toBeGreaterThan(10);
    const request = withObservations(0, toolTokens);
    expect(request.fixedTokens).toBeGreaterThan(counter.countString(observations));
    // The provider charged observations + tools + one 100 token message and 50 tokens of output.
    const inputTokens = request.fixedTokens + 100;
    const pressure = contextPressure(
      { request, inputTokens, outputTokens: 50, outputEstimate: 100 },
      withObservations(1, toolTokens),
      100,
    );
    expect(pressure).toBe(150);
  });

  it('uses input and output once, estimating only additions after output-step', () => {
    const current = snapshot(
      [message, { ...message, id: 'new', content: { format: 2, parts: [{ type: 'text', text: 'new result' }] } }],
      1,
    );
    expect(contextPressure(anchor, current, 150)).toBe(12_050 - anchor.request.fixedTokens);
    expect(contextPressure(anchor, current, 80)).toBe(12_000 - anchor.request.fixedTokens);
    expect(contextPressure(undefined, current, 150)).toBeUndefined();
  });

  it('invalidates after removal, content edits, model changes, system changes or nonconsecutive steps', () => {
    const current = snapshot([message], 1);
    for (const changed of [
      snapshot([], 1),
      snapshot([{ ...message, content: { format: 2, parts: [{ type: 'text', text: 'Different request' }] } }], 1),
      snapshot([message], 1, 'provider/other-model'),
      { ...current, system: 'different system prompt' },
      { ...current, step: 2 },
      { ...current, step: 0 },
    ])
      expect(contextPressure(anchor, changed, 150)).toBeUndefined();
  });

  it('ignores stream markers and token caches, not semantic tool-result fields', () => {
    const cached = structuredClone(message);
    counter.countMessage(cached);
    cached.content.parts.push({ type: 'step-start' });
    expect(snapshot([cached]).parts).toEqual(anchor.request.parts);
    const tool = (createdAt: string): MastraDBMessage => ({
      ...message,
      id: 'tool',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call',
              toolName: 'read',
              args: {},
              result: { createdAt, mastra: 'data' },
            },
          },
        ],
      },
    });
    const before = { ...anchor, request: snapshot([tool('yesterday')]) };
    expect(contextPressure(before, snapshot([tool('today')], 1), 150)).toBeUndefined();
  });
});
