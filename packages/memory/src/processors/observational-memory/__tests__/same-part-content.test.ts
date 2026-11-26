import { describe, expect, it } from 'vitest';

import { samePartContent, samePartExceptTokenEstimate } from '../same-part-content';

/** What the write-back compared before: the parts' JSON without `providerMetadata`. */
function sameJson(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const strip = ({ providerMetadata: _providerMetadata, ...content }: Record<string, unknown>) =>
    JSON.stringify(content);
  return strip(a) === strip(b);
}

/** Parts as storage returns them: a JSON round trip. */
const stored = <T>(part: T): T => JSON.parse(JSON.stringify(part));

const toolPart = {
  type: 'tool-invocation',
  toolInvocation: {
    state: 'result',
    toolCallId: 'call-1',
    toolName: 'search',
    args: { query: 'tea', limit: 3, filters: [{ field: 'kind', value: 'note' }] },
    result: {
      rows: [
        { id: 1, text: 'green' },
        { id: 2, text: null },
      ],
      total: 2,
    },
  },
};

describe('samePartContent', () => {
  // Every case where the old JSON comparison and the new one must agree.
  const agreeing: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['identical text', { type: 'text', text: 'hello' }, { type: 'text', text: 'hello' }],
    ['different text', { type: 'text', text: 'hello' }, { type: 'text', text: 'hello!' }],
    ['different type', { type: 'text', text: 'x' }, { type: 'reasoning', text: 'x' }],
    [
      'only providerMetadata differs',
      { type: 'text', text: 'x', providerMetadata: { mastra: { tokenEstimate: { v: 9 } } } },
      { type: 'text', text: 'x', providerMetadata: { openai: { itemId: 'a' } } },
    ],
    [
      'providerMetadata on one side only',
      { type: 'text', text: 'x', providerMetadata: {} },
      { type: 'text', text: 'x' },
    ],
    ['tool part against its stored copy', toolPart, stored(toolPart)],
    [
      'tool result edited in place',
      toolPart,
      { ...toolPart, toolInvocation: { ...toolPart.toolInvocation, result: { rows: [], total: 0 } } },
    ],
    [
      'nested providerMetadata is content, not skipped',
      { type: 'x', nested: { providerMetadata: 1 } },
      { type: 'x', nested: { providerMetadata: 2 } },
    ],
    [
      'undefined field against a missing one',
      { type: 'text', text: 'x', state: undefined },
      { type: 'text', text: 'x' },
    ],
    ['null field against a missing one', { type: 'text', text: 'x', state: null }, { type: 'text', text: 'x' }],
    ['null against undefined', { type: 'x', v: null }, { type: 'x', v: undefined }],
    ['undefined in an array is null', { type: 'x', v: [1, undefined] }, { type: 'x', v: [1, null] }],
    ['function field against a missing one', { type: 'x', f: () => 1 }, { type: 'x' }],
    ['NaN against null', { type: 'x', v: Number.NaN }, { type: 'x', v: null }],
    ['Infinity against null', { type: 'x', v: Number.POSITIVE_INFINITY }, { type: 'x', v: null }],
    ['number against numeric string', { type: 'x', v: 1 }, { type: 'x', v: '1' }],
    ['0 against false', { type: 'x', v: 0 }, { type: 'x', v: false }],
    ['empty array against empty object', { type: 'x', v: [] }, { type: 'x', v: {} }],
    ['array against object with index keys', { type: 'x', v: ['a'] }, { type: 'x', v: { 0: 'a' } }],
    ['arrays of different length', { type: 'x', v: [1, 2] }, { type: 'x', v: [1, 2, 3] }],
    [
      'Date against its stored ISO string',
      { type: 'x', at: new Date(1795000000000) },
      stored({ type: 'x', at: new Date(1795000000000) }),
    ],
    ['different Dates', { type: 'x', at: new Date(1) }, { type: 'x', at: new Date(2) }],
    ['invalid Date against null', { type: 'x', at: new Date(Number.NaN) }, { type: 'x', at: null }],
    [
      'Buffer against its stored copy',
      { type: 'x', data: Buffer.from('abc') },
      stored({ type: 'x', data: Buffer.from('abc') }),
    ],
    ['different Buffers', { type: 'x', data: Buffer.from('abc') }, { type: 'x', data: Buffer.from('abd') }],
    [
      'Uint8Array against its stored copy',
      { type: 'x', data: new Uint8Array([1, 2]) },
      stored({ type: 'x', data: new Uint8Array([1, 2]) }),
    ],
    [
      'URL against its stored string',
      { type: 'x', url: new URL('https://a.test/x') },
      { type: 'x', url: 'https://a.test/x' },
    ],
    ['custom toJSON', { type: 'x', v: { toJSON: () => 'same' } }, { type: 'x', v: 'same' }],
    ['toJSON receives the key', { type: 'x', v: { toJSON: (key: string) => key } }, { type: 'x', v: 'v' }],
    [
      'toJSON is applied once, not to its own result',
      { type: 'x', v: { toJSON: () => ({ toJSON: () => 1 }) } },
      { type: 'x', v: {} },
    ],
    [
      'a twice-applied toJSON would wrongly match',
      { type: 'x', v: { toJSON: () => ({ toJSON: () => 1 }) } },
      { type: 'x', v: 1 },
    ],
    ['Map serializes as an empty object', { type: 'x', v: new Map([[1, 2]]) }, { type: 'x', v: {} }],
    ['bigint-free large number', { type: 'x', v: 2 ** 60 }, { type: 'x', v: 2 ** 60 }],
    ['-0 against 0', { type: 'x', v: -0 }, { type: 'x', v: 0 }],
  ];

  it.each(agreeing)('agrees with the JSON comparison: %s', (_name, a, b) => {
    expect(samePartContent(a, b)).toBe(sameJson(a, b));
    expect(samePartContent(b, a)).toBe(sameJson(b, a));
  });

  it('agrees with the JSON comparison on 3,000 seeded random parts and near-copies', () => {
    let seed = 0x5eed;
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    const leaves = [0, -0, 1, 1.5, Number.NaN, '', 'a', '0', 'null', true, false, null, undefined, new Date(5)];
    const value = (depth: number): unknown => {
      const r = rand();
      if (depth > 3 || r < 0.5) return leaves[Math.floor(rand() * leaves.length)];
      const size = Math.floor(rand() * 4);
      if (r < 0.75) return Array.from({ length: size }, () => value(depth + 1));
      return Object.fromEntries(Array.from({ length: size }, (_, i) => [`k${i}`, value(depth + 1)]));
    };
    // A copy that keeps key order, sometimes with one leaf, key or element changed.
    const nearCopy = (v: unknown): unknown => {
      if (rand() < 0.08) return value(3);
      if (Array.isArray(v)) {
        const copy = v.map(nearCopy);
        if (rand() < 0.05) copy.push(null);
        return copy;
      }
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const copy = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, nearCopy(x)]));
        if (rand() < 0.05) copy.extra = undefined;
        return copy;
      }
      return v;
    };
    let same = 0;
    for (let i = 0; i < 3_000; i++) {
      const a = { type: 'x', v: value(0) };
      const b = { type: 'x', v: nearCopy(a.v) };
      const expected = sameJson(a, b);
      if (expected) same++;
      expect(samePartContent(a, b), JSON.stringify([a, b])).toBe(expected);
    }
    // Both outcomes are well represented.
    expect(same).toBeGreaterThan(300);
    expect(same).toBeLessThan(2_700);
  });

  // Postgres jsonb and other stores can return object keys in a different order. The JSON comparison saw a different
  // part and skipped the write-back; the content is the same, so the count belongs to it.
  it('ignores object key order', () => {
    const reordered = {
      toolInvocation: {
        result: {
          total: 2,
          rows: [
            { text: 'green', id: 1 },
            { text: null, id: 2 },
          ],
        },
        args: { filters: [{ value: 'note', field: 'kind' }], limit: 3, query: 'tea' },
        toolName: 'search',
        toolCallId: 'call-1',
        state: 'result',
      },
      type: 'tool-invocation',
    };
    expect(samePartContent(toolPart, reordered)).toBe(true);
  });

  it('still tells array order apart', () => {
    const swapped = {
      ...toolPart,
      toolInvocation: {
        ...toolPart.toolInvocation,
        result: { rows: [...toolPart.toolInvocation.result.rows].reverse(), total: 2 },
      },
    };
    expect(samePartContent(toolPart, swapped)).toBe(false);
  });

  it('handles shared references and deep nesting', () => {
    const shared = { a: 1 };
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 2_000; i++) deep = { child: deep };
    expect(
      samePartContent({ type: 'x', l: shared, r: shared, deep }, stored({ type: 'x', l: shared, r: shared, deep })),
    ).toBe(true);
  });

  // JSON.stringify threw on a cycle, so the write-back skipped the part. If cycle detection regresses, this test
  // loops forever and hangs the worker instead of failing.
  it('treats a cyclic part as different instead of looping', () => {
    const cyclic = () => {
      const result: Record<string, unknown> = { id: 1 };
      result.self = result;
      return { type: 'tool-invocation', toolInvocation: { result } };
    };
    expect(samePartContent(cyclic(), cyclic())).toBe(false);
  });

  // The same object pair reached twice is treated like a cycle: the part is skipped, never wrongly matched. Stored
  // parts come back from JSON, so they never share objects; only two live parts can reach this.
  it('fails closed when both sides share an object pair', () => {
    const left = { id: 1 };
    const right = { id: 1 };
    expect(samePartContent({ type: 'x', a: left, b: left }, { type: 'x', a: right, b: right })).toBe(false);
  });

  it('does not serialize the parts', () => {
    const big = { type: 'text', text: 'word '.repeat(100_000) };
    const original = JSON.stringify;
    let calls = 0;
    JSON.stringify = ((...args: Parameters<typeof JSON.stringify>) => {
      calls++;
      return original(...args);
    }) as typeof JSON.stringify;
    try {
      expect(samePartContent(big, { ...big })).toBe(true);
    } finally {
      JSON.stringify = original;
    }
    expect(calls).toBe(0);
  });
});

describe('samePartExceptTokenEstimate', () => {
  /** What the write-back compared on main: the whole part's JSON without `providerMetadata.mastra.tokenEstimate`. */
  const mainContentOf = (part: Record<string, any>) => {
    const { tokenEstimate: _tokenEstimate, ...mastra } = part.providerMetadata?.mastra ?? {};
    return JSON.stringify({ ...part, providerMetadata: { ...part.providerMetadata, mastra } });
  };
  const estimate = { v: 9, tokens: 12 };

  const cases: [string, Record<string, unknown>, Record<string, unknown>][] = [
    [
      'same content, count only on one side',
      { type: 'text', text: 'x', providerMetadata: { mastra: { tokenEstimate: estimate } } },
      { type: 'text', text: 'x' },
    ],
    [
      'different text',
      { type: 'text', text: 'x', providerMetadata: { mastra: { tokenEstimate: estimate } } },
      { type: 'text', text: 'y' },
    ],
    [
      'different modelOutput',
      { type: 'text', text: 'x', providerMetadata: { mastra: { tokenEstimate: estimate, modelOutput: 'a' } } },
      { type: 'text', text: 'x', providerMetadata: { mastra: { modelOutput: 'b' } } },
    ],
    [
      'same modelOutput',
      { type: 'text', text: 'x', providerMetadata: { mastra: { tokenEstimate: estimate, modelOutput: 'a' } } },
      { type: 'text', text: 'x', providerMetadata: { mastra: { modelOutput: 'a' } } },
    ],
    [
      'other provider metadata differs',
      { type: 'text', text: 'x', providerMetadata: { openai: { itemId: 'a' }, mastra: { tokenEstimate: estimate } } },
      { type: 'text', text: 'x', providerMetadata: { openai: { itemId: 'b' } } },
    ],
    ['empty providerMetadata against none', { type: 'text', text: 'x', providerMetadata: {} }, { type: 'text', text: 'x' }],
    ['tool part against its stored copy', { ...toolPart, providerMetadata: { mastra: { tokenEstimate: estimate } } }, stored(toolPart)],
  ];

  it.each(cases)('agrees with main\'s JSON comparison: %s', (_name, a, b) => {
    expect(samePartExceptTokenEstimate(a, b)).toBe(mainContentOf(a) === mainContentOf(b));
  });

  it('ignores object key order that main treated as a change', () => {
    const a = { type: 'x', value: { p: 1, q: 2 }, providerMetadata: { mastra: { tokenEstimate: estimate } } };
    const b = { type: 'x', value: { q: 2, p: 1 } };
    expect(mainContentOf(a) === mainContentOf(b)).toBe(false);
    expect(samePartExceptTokenEstimate(a, b)).toBe(true);
  });

  it('does not match a cyclic part', () => {
    const cyclic: Record<string, unknown> = { type: 'x' };
    cyclic.self = cyclic;
    expect(samePartExceptTokenEstimate(cyclic, cyclic)).toBe(true);
    const other: Record<string, unknown> = { type: 'x' };
    other.self = other;
    expect(samePartExceptTokenEstimate(cyclic, other)).toBe(false);
  });
});
