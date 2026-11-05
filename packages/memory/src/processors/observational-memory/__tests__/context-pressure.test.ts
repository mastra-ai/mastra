import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';
import { contextPressure, snapshotContextRequest } from '../context-pressure';
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
  it('uses input and output once, estimating only additions after output-step', () => {
    const current = snapshot(
      [message, { ...message, id: 'new', content: { format: 2, parts: [{ type: 'text', text: 'new result' }] } }],
      1,
    );
    const overhead = anchor.request.fixedTokens;
    expect(contextPressure(anchor, current, 150)).toBe(12_050 - overhead);
    expect(contextPressure(anchor, current, 80)).toBe(12_000 - overhead);
    expect(contextPressure(undefined, current, 150)).toBeUndefined();
  });

  it('excludes the anchored request overhead: every system message and the tool definitions', () => {
    const observations = '<observations>' + 'Read the file and continue the task. '.repeat(200) + '</observations>';
    const listWith = (messages: MastraDBMessage[]) => {
      const list = new MessageList();
      list.addSystem('You read files.');
      list.addSystem(observations, 'observational-memory');
      list.add(messages, 'memory');
      return list;
    };
    const next: MastraDBMessage = {
      ...message,
      id: 'new',
      content: { format: 2, parts: [{ type: 'text', text: 'new' }] },
    };
    const withOverhead = {
      request: snapshotContextRequest(listWith([message]), 0, 'provider/model', counter, 500),
      inputTokens: 10_000,
      outputTokens: 2_000,
      outputEstimate: 100,
    };
    const overhead = withOverhead.request.fixedTokens;
    expect(overhead, 'the tagged observations block and the 500 tool tokens are both counted').toBeGreaterThan(
      500 + counter.countString(observations) - 1,
    );
    const current = snapshotContextRequest(listWith([message, next]), 1, 'provider/model', counter);
    expect(contextPressure(withOverhead, current, 150)).toBe(12_050 - overhead);
    // A tagged system message that changed since the request is a different prompt: no anchor.
    const rewritten = listWith([message, next]).clearSystemMessages('observational-memory');
    rewritten.addSystem('<observations>shorter</observations>', 'observational-memory');
    const stale = snapshotContextRequest(rewritten, 1, 'provider/model', counter);
    expect(contextPressure(withOverhead, stale, 150)).toBeUndefined();
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
