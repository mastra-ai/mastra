import type { MastraDBMessage } from '@mastra/core/agent';
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

describe('hash-checked per-part token counts', () => {
  it('a counted part is not hashed again by the same counter while its strings are unchanged', () => {
    const counter = new TokenCounter();
    const msg = message([{ type: 'text', text }]);
    const first = counter.countMessage(msg);
    hashes.count = 0;
    expect(counter.countMessage(msg)).toBe(first);
    expect(hashes.count).toBe(0);
  });

  it('a new counter reuses the stored count after the content hash matches, without recounting', () => {
    const msg = message([{ type: 'text', text }, toolPart()]);
    const first = new TokenCounter().countMessage(msg);
    const stored = JSON.parse(JSON.stringify(msg)) as MastraDBMessage;
    countSpy.mockClear();
    expect(new TokenCounter().countMessage(stored)).toBe(first);
    expect(countSpy.mock.calls.map(call => call[0])).toEqual(['assistant']);
  });

  it('recounts text edited outside Core', () => {
    const msg = message([{ type: 'text', text }]);
    const counter = new TokenCounter();
    const before = counter.countMessage(msg);
    (msg.content.parts[0] as { text: string }).text = text + ' And more words appended later on.';
    expect(counter.countMessage(msg)).toBeGreaterThan(before);
  });

  it('recounts object tool results edited in place', () => {
    const msg = message([toolPart()]);
    const counter = new TokenCounter();
    const before = counter.countMessage(msg);
    const part = msg.content.parts[0] as any;
    part.toolInvocation.result.rows[0].note += ' appended '.repeat(50);
    expect(counter.countMessage(msg)).toBeGreaterThan(before);
  });

  it('ignores a forged or stale stored count', () => {
    const msg = message([{ type: 'text', text }]);
    const expected = new TokenCounter().countMessage(msg);
    const forged = message([
      {
        type: 'text',
        text,
        providerMetadata: {
          mastra: { tokenEstimate: { 'text:forged': { v: 8, source: 'v8:tokenx', key: 'text:forged', tokens: 1 } } },
        },
      } as Part,
    ]);
    expect(new TokenCounter().countMessage(forged)).toBe(expected);
  });

  it.each([
    ['an object', () => ({ toJSON: () => ({ report: text }) })],
    ['a string', () => ({ toJSON: () => text })],
    ['a Date', () => ({ when: new Date(0), note: text })],
  ])('a tool result whose toJSON() returns %s is reused after a save and reload without recounting', (_n, make) => {
    const live = message([
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'lookup', args: {}, result: make() },
      } as Part,
    ]);
    new TokenCounter().countMessage(live);
    // Storage serializes toJSON(), so the first read of the stored form is what gets saved back.
    const stored = JSON.parse(JSON.stringify(live)) as MastraDBMessage;
    const first = new TokenCounter().countMessage(stored);
    const reloaded = JSON.parse(JSON.stringify(stored)) as MastraDBMessage;
    expect(Object.keys(estimateOf(reloaded.content.parts[0]!)).length).toBeGreaterThan(0);
    countSpy.mockClear();
    expect(new TokenCounter().countMessage(reloaded)).toBe(first);
    expect(countSpy.mock.calls.map(call => call[0])).toEqual(['assistant']);
  });

  it('upgrade from the trusted-count format: legacy v9 entries are ignored and messages without counts are counted', () => {
    const msg = message([{ type: 'text', text }]);
    const expected = new TokenCounter().countMessage(msg);
    const legacy = message([
      {
        type: 'text',
        text,
        providerMetadata: {
          mastra: { tokenEstimate: { 'text:legacy': { v: 9, source: 'trusted', key: 'text:legacy', tokens: 1 } } },
        },
      } as Part,
    ]);
    expect(new TokenCounter().countMessage(legacy)).toBe(expected);
    expect(new TokenCounter().countMessage(message([{ type: 'text', text }], 'bare'))).toBe(expected);
  });

  it('a custom estimator never reads counts made by the stock one', () => {
    const msg = message([{ type: 'text', text }]);
    new TokenCounter().countMessage(msg);
    class Flat extends TokenCounter {
      override countString(value: string) {
        return value ? 1 : 0;
      }
    }
    expect(new Flat().countMessage(msg)).toBeLessThan(new TokenCounter().countMessage(msg));
  });

  it('a field-defined custom estimator never reuses counts made by the stock one', () => {
    class Doubled extends TokenCounter {
      override countString = (value: string): number => super.countString(value) * 2;
    }
    const stored = message([{ type: 'text', text }]);
    new TokenCounter().countMessage(stored);
    const fresh = message([{ type: 'text', text }], 'm2');
    expect(new Doubled().countMessage(stored)).toBe(new Doubled().countMessage(fresh));
  });
});
