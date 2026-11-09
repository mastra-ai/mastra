import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import { CacheKeyGenerator } from './CacheKeyGenerator';

/**
 * https://github.com/mastra-ai/mastra/issues/26859
 *
 * Empty-text reasoning parts must be keyed by whatever stable identity their provider
 * stores in metadata (signatures, redacted data, item ids), regardless of provider name.
 */
const v4Reasoning = (providerMetadata?: Record<string, unknown>) =>
  ({ type: 'reasoning', reasoning: '', details: [], ...(providerMetadata ? { providerMetadata } : {}) }) as any;

describe('CacheKeyGenerator provider-generic reasoning identity (#26859)', () => {
  const acmeA = { acme: { signature: 'sig-A' } };
  const acmeB = { acme: { signature: 'sig-B' } };

  it('fromAIV4Part / fromDBParts distinguish empty-text reasoning by metadata identity', () => {
    expect(CacheKeyGenerator.fromAIV4Part(v4Reasoning(acmeA))).not.toBe(
      CacheKeyGenerator.fromAIV4Part(v4Reasoning(acmeB)),
    );
    expect(CacheKeyGenerator.fromDBParts([v4Reasoning(acmeA)])).not.toBe(
      CacheKeyGenerator.fromDBParts([v4Reasoning(acmeB)]),
    );
    expect(CacheKeyGenerator.fromAIV4Part(v4Reasoning(acmeA))).toBe(CacheKeyGenerator.fromAIV4Part(v4Reasoning(acmeA)));
  });

  it('fromAIV4Part distinguishes reasoning by detail signatures and redacted data', () => {
    const withDetail = (detail: any) => ({ type: 'reasoning', reasoning: '', details: [detail] }) as any;
    expect(CacheKeyGenerator.fromAIV4Part(withDetail({ type: 'text', text: '', signature: 'aaa' }))).not.toBe(
      CacheKeyGenerator.fromAIV4Part(withDetail({ type: 'text', text: '', signature: 'bbb' })),
    );
    expect(CacheKeyGenerator.fromAIV4Part(withDetail({ type: 'redacted', data: 'aaa' }))).not.toBe(
      CacheKeyGenerator.fromAIV4Part(withDetail({ type: 'redacted', data: 'bbb' })),
    );
  });

  it('ignores non-identity metadata so identical blocks still dedupe', () => {
    expect(
      CacheKeyGenerator.fromAIV4Part(
        v4Reasoning({ acme: { signature: 'sig-A', cacheControl: { type: 'ephemeral' } } }),
      ),
    ).toBe(CacheKeyGenerator.fromAIV4Part(v4Reasoning(acmeA)));
  });

  it('fromAIV4CoreMessageContent distinguishes reasoning by metadata, options, signature and redacted data', () => {
    const key = (part: any) => CacheKeyGenerator.fromAIV4CoreMessageContent([part]);
    expect(key({ type: 'reasoning', text: '', providerMetadata: acmeA })).not.toBe(
      key({ type: 'reasoning', text: '', providerMetadata: acmeB }),
    );
    expect(key({ type: 'reasoning', text: '', providerOptions: acmeA })).not.toBe(
      key({ type: 'reasoning', text: '', providerOptions: acmeB }),
    );
    expect(key({ type: 'reasoning', text: '', signature: 'aaa' })).not.toBe(
      key({ type: 'reasoning', text: '', signature: 'bbb' }),
    );
    expect(key({ type: 'redacted-reasoning', data: 'aaa' })).not.toBe(key({ type: 'redacted-reasoning', data: 'bbb' }));
  });

  it('fromAIV5Parts and fromAIV5ModelMessageContent distinguish reasoning by metadata identity', () => {
    expect(CacheKeyGenerator.fromAIV5Parts([{ type: 'reasoning', text: '', providerMetadata: acmeA } as any])).not.toBe(
      CacheKeyGenerator.fromAIV5Parts([{ type: 'reasoning', text: '', providerMetadata: acmeB } as any]),
    );
    expect(
      CacheKeyGenerator.fromAIV5ModelMessageContent([{ type: 'reasoning', text: '', providerOptions: acmeA } as any]),
    ).not.toBe(
      CacheKeyGenerator.fromAIV5ModelMessageContent([{ type: 'reasoning', text: '', providerOptions: acmeB } as any]),
    );
  });

  it('keeps the existing OpenAI itemId key segment', () => {
    const key = CacheKeyGenerator.fromAIV4Part(v4Reasoning({ openai: { itemId: 'rs_123' } }));
    expect(key).toContain('|openai:rs_123');
  });

  describe.each([
    ['synthetic provider', (sig: string) => ({ acme: { signature: sig } })],
    ['anthropic signature', (sig: string) => ({ anthropic: { signature: sig } })],
    ['anthropic redacted data', (sig: string) => ({ anthropic: { redactedData: sig } })],
    ['google thought signature', (sig: string) => ({ google: { thoughtSignature: sig } })],
  ])('MessageList multi-step merge (%s)', (_name, metadata) => {
    const step1 = () => ({
      id: 'assistant-1',
      role: 'assistant' as const,
      createdAt: new Date('2024-01-01T00:00:01Z'),
      content: {
        format: 2 as const,
        parts: [
          v4Reasoning(metadata('sig-step-1')),
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: 'call-1',
              toolName: 'lookup',
              args: {},
              result: 'A',
            },
          },
        ],
      },
    });
    const step2 = () => ({
      id: 'assistant-1',
      role: 'assistant' as const,
      createdAt: new Date('2024-01-01T00:00:02Z'),
      content: {
        format: 2 as const,
        parts: [
          v4Reasoning(metadata('sig-step-2')),
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: 'call-2',
              toolName: 'lookup',
              args: {},
              result: 'B',
            },
          },
        ],
      },
    });
    const reasoningParts = (list: MessageList) =>
      list.get.all
        .db()
        .filter(m => m.role === 'assistant')
        .flatMap(m => m.content.parts)
        .filter(p => p.type === 'reasoning');

    it("keeps each step's empty-text reasoning block", () => {
      const list = new MessageList();
      list.add({ role: 'user', content: 'look up A then B' }, 'input');
      list.add(step1(), 'response');
      list.add(step2(), 'response');

      expect(reasoningParts(list).map(p => (p as any).providerMetadata)).toEqual([
        metadata('sig-step-1'),
        metadata('sig-step-2'),
      ]);
    });

    it('still dedupes a byte-identical re-add', () => {
      const list = new MessageList();
      list.add({ role: 'user', content: 'look up A then B' }, 'input');
      list.add(step1(), 'response');
      list.add(step1(), 'response');

      expect(reasoningParts(list)).toHaveLength(1);
    });
  });
});
