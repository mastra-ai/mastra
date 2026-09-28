import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';

const reasoning = (text: string, signature?: string, providerMetadata?: Record<string, Record<string, unknown>>) => ({
  type: 'reasoning' as const,
  reasoning: text,
  details: [{ type: 'text' as const, text }],
  createdAt: 1_700_000_000_000,
  ...(signature ? { providerMetadata: { bedrock: { signature } } } : {}),
  ...(providerMetadata ? { providerMetadata } : {}),
});

const call = (toolCallId: string) => ({
  type: 'tool-invocation' as const,
  toolInvocation: {
    state: 'result' as const,
    toolCallId,
    toolName: 'getStatus',
    args: {},
    result: { ok: true },
  },
});

const userMessage = (id: string, text: string) => ({
  id,
  role: 'user' as const,
  createdAt: new Date(),
  content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
});

function roundTrip(list: MessageList) {
  return new MessageList().deserialize(list.serialize());
}

function buildList(trailingReasoning: ReturnType<typeof reasoning>) {
  const list = new MessageList();
  list.add(userMessage('u1', 'go'), 'memory');
  list.add(
    {
      id: 'a1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          call('c1'),
          { type: 'step-start' },
          reasoning('signed', 'sig'),
          call('c2'),
          { type: 'step-start' },
          trailingReasoning,
          { type: 'step-start' },
          { type: 'error', error: { name: 'AI_APICallError', message: 'boom' } },
        ] as any,
      },
    },
    'memory',
  );
  list.add(userMessage('u2', 'continue'), 'memory');
  return roundTrip(list);
}

/** Role plus, per part, its type and tool call id (when present). */
function shape(prompt: ReturnType<MessageList['get']['all']['aiV5']['prompt']>) {
  return prompt.map(m => ({
    role: m.role,
    parts: Array.isArray(m.content)
      ? m.content.map(p => ('toolCallId' in p ? `${p.type}:${p.toolCallId}` : p.type))
      : [typeof m.content],
  }));
}

describe('unsigned reasoning from a dead step (#24558)', () => {
  it('drops the unsigned reasoning-only message and keeps the tool call/result pairs in order', () => {
    const prompt = buildList(reasoning('step died before the signature arrived')).get.all.aiV5.prompt();

    expect(shape(prompt)).toEqual([
      { role: 'user', parts: ['text'] },
      { role: 'assistant', parts: ['tool-call:c1'] },
      { role: 'tool', parts: ['tool-result:c1'] },
      { role: 'assistant', parts: ['reasoning', 'tool-call:c2'] },
      { role: 'tool', parts: ['tool-result:c2'] },
      { role: 'user', parts: ['text'] },
    ]);
    // The surviving reasoning is the signed one from the completed step.
    expect(prompt[3]!.content).toContainEqual(
      expect.objectContaining({
        type: 'reasoning',
        text: 'signed',
        providerOptions: expect.objectContaining({ bedrock: { signature: 'sig' } }),
      }),
    );
  });

  it('drops unsigned reasoning in prompt-with-suspended mode but keeps it in response mode', () => {
    const ui = buildList(reasoning('step died before the signature arrived')).get.all.aiV5.ui();
    const suspended = aiV5UIMessagesToAIV5ModelMessages(ui, [], 'prompt-with-suspended');
    const response = aiV5UIMessagesToAIV5ModelMessages(ui, [], 'response');
    expect(JSON.stringify(suspended)).not.toContain('step died before the signature arrived');
    expect(JSON.stringify(response)).toContain('step died before the signature arrived');
  });

  it('leaves adjacent user messages when the only assistant turn was unsigned reasoning', () => {
    // Adjacent user messages are valid prompt input; providers merge or accept them.
    const list = new MessageList();
    list.add(userMessage('u1', 'hi'), 'memory');
    list.add(
      {
        id: 'a1',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'step-start' }, reasoning('died thinking')] as any },
      },
      'memory',
    );
    list.add(userMessage('u2', 'again'), 'memory');

    expect(roundTrip(list).get.all.aiV5.prompt()).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'user', content: [{ type: 'text', text: 'again' }] },
    ]);
  });

  // One case per REPLAYABLE_REASONING_KEYS entry. OpenAI itemId matters most:
  // dropping it causes a non-retryable 400 (#22291).
  it.each([
    ['anthropic', 'signature'],
    ['bedrock', 'signature'],
    ['anthropic', 'redactedData'],
    ['openai', 'itemId'],
    ['openai', 'reasoningEncryptedContent'],
    ['google', 'thoughtSignature'],
  ])('keeps a reasoning-only message carrying %s.%s in prompt mode', (namespace, key) => {
    const prompt = buildList(
      reasoning('replayable thinking', undefined, { [namespace]: { [key]: 'token' } }),
    ).get.all.aiV5.prompt();

    const kept = prompt.find(
      m =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.some(p => p.type === 'reasoning' && p.text === 'replayable thinking'),
    );
    expect(kept?.content).toEqual([
      expect.objectContaining({
        type: 'reasoning',
        text: 'replayable thinking',
        providerOptions: expect.objectContaining({ [namespace]: expect.objectContaining({ [key]: 'token' }) }),
      }),
    ]);
  });
});
