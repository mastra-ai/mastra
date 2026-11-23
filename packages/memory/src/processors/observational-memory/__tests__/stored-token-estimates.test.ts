import type { MastraDBMessage } from '@mastra/core/agent';
import { clearTokenEstimates } from '@mastra/core/agent/message-list';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hashes = vi.hoisted(() => ({ count: 0 }));
vi.mock('node:crypto', async importOriginal => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    createHash: (...args: Parameters<typeof actual.createHash>) => {
      hashes.count++;
      return actual.createHash(...args);
    },
  };
});

import { TokenCounter } from '../token-counter';

type Part = MastraDBMessage['content']['parts'][number];

function message(parts: Part[], id = 'm1'): MastraDBMessage {
  return { id, role: 'assistant', createdAt: new Date(0), content: { format: 2, parts } };
}

function estimateOf(part: Part): Record<string, { v: number; source: string; key: string; tokens: number }> {
  const estimate = (part as { providerMetadata?: { mastra?: { tokenEstimate?: any } } }).providerMetadata?.mastra
    ?.tokenEstimate;
  if (!estimate) return {};
  return 'source' in estimate ? { [estimate.key]: estimate } : estimate;
}

const text = 'Hiring slows in Q3 while the budget holds steady across teams. '.repeat(20);
const toolPart = (): Part =>
  ({
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: 'c1',
      toolName: 'lookup',
      args: { query: 'budget', limit: 5 },
      result: { rows: [{ id: 1, note: text }] },
    },
  }) as Part;

let countSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  hashes.count = 0;
  countSpy = vi.spyOn(TokenCounter.prototype, 'countString');
});
afterEach(() => vi.restoreAllMocks());

describe('stored per-part token counts', () => {
  it('a stored count is read back with no hashing and no recount', () => {
    const msg = message([{ type: 'text', text }, toolPart()]);
    const first = new TokenCounter().countMessage(msg);
    expect(Object.values(estimateOf(msg.content.parts[0]!)).map(entry => entry.v)).toEqual([9]);

    hashes.count = 0;
    countSpy.mockClear();
    // A new counter, as a fresh Agent in the next request would make.
    expect(new TokenCounter().countMessage(msg)).toBe(first);
    // Only the role label is counted; no part content is.
    expect(countSpy.mock.calls.map(call => call[0])).toEqual(['assistant']);
    expect(hashes.count).toBe(0);
  });

  it('survives a JSON round trip, as through storage', () => {
    const msg = message([{ type: 'text', text }]);
    const first = new TokenCounter().countMessage(msg);
    const stored = JSON.parse(JSON.stringify(msg)) as MastraDBMessage;
    countSpy.mockClear();
    expect(new TokenCounter().countMessage(stored)).toBe(first);
    expect(countSpy.mock.calls.map(call => call[0])).toEqual(['assistant']);
  });

  it('never reads a v8 entry by presence, even one whose text was edited', () => {
    const fresh = new TokenCounter().countMessage(message([{ type: 'text', text: 'short edited text' }]));
    const msg = message([
      {
        type: 'text',
        text: 'short edited text',
        providerMetadata: {
          mastra: { tokenEstimate: { v: 8, source: 'v8:tokenx', key: 'text:deadbeef', tokens: 9_999 } },
        },
      } as Part,
    ]);
    expect(new TokenCounter().countMessage(msg)).toBe(fresh);
    const entries = estimateOf(msg.content.parts[0]!);
    expect(entries['text:deadbeef']?.tokens).toBe(9_999);
    expect(entries['trusted:text']?.v).toBe(9);
  });

  it('a custom estimator never reads or writes stored counts', () => {
    class Doubled extends TokenCounter {
      override countString(value: string): number {
        return super.countString(value) * 2;
      }
    }
    const msg = message([{ type: 'text', text }]);
    const stock = new TokenCounter().countMessage(msg);
    const doubled = new Doubled().countMessage(msg);
    expect(doubled).toBeGreaterThan(stock);
    const custom = message([{ type: 'text', text }], 'm2');
    new Doubled().countMessage(custom);
    expect(Object.values(estimateOf(custom.content.parts[0]!)).some(entry => entry.v === 9)).toBe(false);
  });

  it('a non-plain tool result keeps the payload-keyed count', () => {
    const part = toolPart() as any;
    part.toolInvocation.result = new Map([['a', 1]]);
    new TokenCounter().countMessage(message([part]));
    expect(Object.keys(estimateOf(part)).some(key => key === 'trusted:tool-result-json')).toBe(false);
  });

  it('an edit without a clear keeps the old count (the documented contract)', () => {
    const msg = message([{ type: 'text', text }]);
    const before = new TokenCounter().countMessage(msg);
    (msg.content.parts[0] as { text: string }).text = 'tiny';
    expect(new TokenCounter().countMessage(msg)).toBe(before);
  });

  it('clearing a copy leaves parts that shared its metadata untouched', () => {
    const shared = {
      mastra: {
        tokenEstimate: { 'trusted:text': { v: 9, source: 'v9:tokenx', key: 'trusted:text', tokens: 5 } },
        modelOutput: 'kept',
      },
      openai: { itemId: 'x' },
    };
    const a = { type: 'text', text: 'a', providerMetadata: shared } as Part;
    const cleared = clearTokenEstimates(a) as any;
    expect(cleared.providerMetadata).not.toBe(shared);
    expect(cleared.providerMetadata.mastra).not.toBe(shared.mastra);
    expect(cleared.providerMetadata.mastra).toEqual({ modelOutput: 'kept' });
    expect(cleared.providerMetadata.openai).toEqual({ itemId: 'x' });
    expect(shared.mastra.tokenEstimate['trusted:text'].tokens).toBe(5);
  });
});
