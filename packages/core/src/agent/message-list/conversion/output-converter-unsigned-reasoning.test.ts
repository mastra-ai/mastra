import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';

const reasoning = (text: string, signature?: string) => ({
  type: 'reasoning' as const,
  reasoning: text,
  details: [{ type: 'text' as const, text }],
  createdAt: 1_700_000_000_000,
  ...(signature ? { providerMetadata: { bedrock: { signature } } } : {}),
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

function buildList(trailingReasoning: ReturnType<typeof reasoning>) {
  const list = new MessageList();
  list.add(
    { id: 'u1', role: 'user', createdAt: new Date(), content: { format: 2, parts: [{ type: 'text', text: 'go' }] } },
    'memory',
  );
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
  list.add(
    {
      id: 'u2',
      role: 'user',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'continue' }] },
    },
    'memory',
  );
  return new MessageList().deserialize(list.serialize());
}

describe('unsigned reasoning from a dead step (#24558)', () => {
  it('does not emit a reasoning-only assistant message when the reasoning carries no provider metadata', () => {
    const prompt = buildList(reasoning('step died before the signature arrived')).get.all.aiV5.prompt();

    const reasoningOnly = prompt.filter(
      m =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.length > 0 &&
        m.content.every(p => p.type === 'reasoning'),
    );
    expect(reasoningOnly).toEqual([]);
    expect(JSON.stringify(prompt)).not.toContain('step died before the signature arrived');
    // Signed reasoning from the earlier completed step is still replayed.
    expect(JSON.stringify(prompt)).toContain('"signed"');
    expect(prompt.at(-1)?.role).toBe('user');
  });

  it('drops unsigned reasoning in prompt-with-suspended mode but keeps it in response mode', () => {
    const ui = buildList(reasoning('step died before the signature arrived')).get.all.aiV5.ui();
    const suspended = aiV5UIMessagesToAIV5ModelMessages(ui, [], 'prompt-with-suspended');
    const response = aiV5UIMessagesToAIV5ModelMessages(ui, [], 'response');
    expect(JSON.stringify(suspended)).not.toContain('step died before the signature arrived');
    expect(JSON.stringify(response)).toContain('step died before the signature arrived');
  });

  it('keeps a reasoning-only block when its reasoning is signed', () => {
    const prompt = buildList(reasoning('finished thinking', 'sig2')).get.all.aiV5.prompt();
    expect(JSON.stringify(prompt)).toContain('finished thinking');
  });
});
