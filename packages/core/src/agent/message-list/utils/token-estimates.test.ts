import { describe, expect, it } from 'vitest';

import { RegexFilterProcessor } from '../../../processors/processors/regex-filter';
import { TokenLimiterProcessor } from '../../../processors/processors/token-limiter';
import { UnicodeNormalizer } from '../../../processors/processors/unicode-normalizer';
import { filterMessagesForPersistence } from '../../filter-messages-for-persistence';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';
import { clearTokenEstimates, clearTokenEstimatesInPlace } from './token-estimates';

const trusted = (key: string, tokens = 1) => ({ v: 9, source: 'v9:tokenx', key, tokens });
const v8 = { v: 8, source: 'v8:tokenx', key: 'text:abc', tokens: 3 };
const client = { v: 0, source: 'client', key: 'client', tokens: 7 };

function withTrusted<T extends object>(part: T, key = 'trusted:text'): T {
  return {
    ...part,
    providerMetadata: { mastra: { tokenEstimate: { [key]: trusted(key), 'text:abc': v8 } }, other: { keep: 1 } },
  };
}

function trustedKeys(part: unknown): string[] {
  const estimate = (part as { providerMetadata?: { mastra?: { tokenEstimate?: Record<string, { v: number }> } } })
    ?.providerMetadata?.mastra?.tokenEstimate;
  if (!estimate) return [];
  return Object.entries(estimate)
    .filter(([, entry]) => entry?.v === 9)
    .map(([key]) => key);
}

function dbMessage(role: 'user' | 'assistant', parts: any[], id = 'm1'): MastraDBMessage {
  return { id, role, createdAt: new Date(1_000), threadId: 't', resourceId: 'r', content: { format: 2, parts } };
}

const abort = (() => {
  throw new Error('aborted');
}) as (reason?: string) => never;

describe('clearTokenEstimates', () => {
  it('removes only trusted entries, keeping v8, client and other metadata', () => {
    const part = {
      type: 'text',
      text: 'x',
      providerMetadata: {
        mastra: { tokenEstimate: { 'trusted:text': trusted('trusted:text'), 'text:abc': v8, client }, modelOutput: 1 },
        other: { keep: 1 },
      },
    };
    const cleared = clearTokenEstimates(part);
    expect(cleared.providerMetadata).toEqual({
      mastra: { tokenEstimate: { 'text:abc': v8, client }, modelOutput: 1 },
      other: { keep: 1 },
    });
    expect(trustedKeys(part)).toEqual(['trusted:text']);
  });

  it('a single trusted entry stored without a map is removed', () => {
    const part = { type: 'text', providerMetadata: { mastra: { tokenEstimate: trusted('trusted:text') } } };
    clearTokenEstimatesInPlace(part);
    expect(part).toEqual({ type: 'text' });
  });
});

describe('places that change a part clear its trusted count', () => {
  it('caller input and memory-loaded parts both keep their counts', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(dbMessage('user', [withTrusted({ type: 'text', text: 'from memory' })], 'mem'), 'memory');
    list.add(dbMessage('user', [withTrusted({ type: 'text', text: 'from caller' })], 'in'), 'input');
    const [fromMemory, fromInput] = list.get.all.db();
    expect(trustedKeys(fromMemory!.content.parts[0])).toEqual(['trusted:text']);
    expect(trustedKeys(fromInput!.content.parts[0])).toEqual(['trusted:text']);
    expect((fromInput!.content.parts[0] as any).providerMetadata.other).toEqual({ keep: 1 });
  });

  it('committing a tool result clears the call part counts', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    const call = withTrusted(
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'c1', toolName: 'lookup', args: { q: 1 } },
      },
      'trusted:tool-call-args-json',
    );
    list.add(dbMessage('assistant', [call]), 'memory');
    expect(
      list.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'lookup', args: { q: 1 }, result: { ok: 1 } },
        providerMetadata: { mastra: { modelOutput: { type: 'text', value: 'mapped' } } },
      } as any),
    ).toBe(true);
    const part = list.get.all.db()[0]!.content.parts[0] as any;
    expect(part.toolInvocation.result).toEqual({ ok: 1 });
    expect(part.providerMetadata.mastra.modelOutput).toEqual({ type: 'text', value: 'mapped' });
    expect(trustedKeys(part)).toEqual([]);
  });

  it('the working-memory strip on save clears the rebuilt part', () => {
    const [message] = filterMessagesForPersistence([
      dbMessage('assistant', [withTrusted({ type: 'text', text: 'hi <working_memory>x</working_memory>' })]),
    ]);
    expect(message!.content.parts[0]).toMatchObject({ text: 'hi' });
    expect(trustedKeys(message!.content.parts[0])).toEqual([]);
  });

  it('UnicodeNormalizer clears the parts it rewrites', () => {
    const [message] = new UnicodeNormalizer({ collapseWhitespace: true }).processInput({
      messages: [dbMessage('user', [withTrusted({ type: 'text', text: 'a    b' })])],
      abort,
    });
    expect(trustedKeys(message!.content.parts[0])).toEqual([]);
  });

  it('RegexFilter clears the parts it redacts', async () => {
    const filter = new RegexFilterProcessor({ rules: [{ name: 'code', pattern: /secret-\d+/g }], strategy: 'redact' });
    const messages = (await filter.processInput({
      messages: [dbMessage('user', [withTrusted({ type: 'text', text: 'my secret-42' })])],
      abort,
    } as any)) as MastraDBMessage[];
    expect(messages[0]!.content.parts[0]).toMatchObject({ text: 'my [REDACTED]' });
    expect(trustedKeys(messages[0]!.content.parts[0])).toEqual([]);
  });

  it('TokenLimiterProcessor clears the parts it truncates', async () => {
    const [message] = await new TokenLimiterProcessor({ limit: 5 }).processOutputResult({
      messages: [dbMessage('assistant', [withTrusted({ type: 'text', text: 'word '.repeat(200) })])],
      abort,
    });
    expect((message!.content.parts[0] as { text: string }).text.length).toBeLessThan(1000);
    expect(trustedKeys(message!.content.parts[0])).toEqual([]);
  });
});
