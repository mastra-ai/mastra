import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';
import { contextPressure, nextOverhead, snapshotContextRequest } from '../context-pressure';
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
const anchor = {
  request: snapshot([message]),
  inputTokens: 10_000,
  outputTokens: 2_000,
  outputEstimate: 100,
  overheadTokens: 0,
};

describe('measured overhead', () => {
  const request = (system: string, model = 'provider/model', messageEstimate = 100) => ({
    ...snapshot([message], 0, model),
    system,
    messageEstimate,
  });

  it('keeps the smallest residual while the system prompt and model are unchanged', () => {
    const first = nextOverhead(undefined, request('a'), 600); // residual 500
    expect(first.tokens).toBe(500);
    // Hidden growth (e.g. encrypted reasoning) raises the residual; the floor must not follow it.
    expect(nextOverhead(first, request('a'), 900).tokens).toBe(500);
    expect(nextOverhead(first, request('a'), 450).tokens).toBe(350);
  });

  it('starts over when the system prompt or model changes', () => {
    const first = nextOverhead(undefined, request('a'), 200); // residual 100
    expect(nextOverhead(first, request('b'), 3_100).tokens).toBe(3_000);
    expect(nextOverhead(first, request('a', 'provider/other'), 3_100).tokens).toBe(3_000);
  });
});

describe('context usage anchors', () => {
  it('does not count tagged system messages (OM observations) as message pressure', () => {
    const observations = 'Observed: '.concat('the user prefers short answers. '.repeat(400));
    const withObservations = (step: number) => {
      const list = new MessageList();
      list.add([message], 'memory');
      list.addSystem({ role: 'system', content: observations }, 'observational-memory');
      return snapshotContextRequest(list, step, 'provider/model', counter);
    };
    const request = withObservations(0);
    // The provider charged 3,000 tokens for observations, tools and prompt text, plus the message.
    const overheadTokens = 3_000;
    const pressure = contextPressure(
      {
        request,
        inputTokens: overheadTokens + request.messageEstimate,
        outputTokens: 50,
        outputEstimate: 100,
        overheadTokens,
      },
      withObservations(1),
      100,
    );
    expect(pressure).toBe(request.messageEstimate + 50);
    // Observations are tagged system content: the old untagged-only snapshot hashed none of them.
    expect(request.system).not.toBe(snapshot([message]).system);
  });

  it('uses input and output once, estimating only additions after output-step', () => {
    const current = snapshot(
      [message, { ...message, id: 'new', content: { format: 2, parts: [{ type: 'text', text: 'new result' }] } }],
      1,
    );
    expect(contextPressure(anchor, current, 150)).toBe(12_050);
    expect(contextPressure(anchor, current, 80)).toBe(12_000);
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
