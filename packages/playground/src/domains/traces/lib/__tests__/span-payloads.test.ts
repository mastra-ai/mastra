import { describe, expect, it } from 'vitest';

import type { TimelineSpan } from '../build-thread-timeline';
import {
  HIGHLIGHT_LIMIT,
  MAX_VALUE_LENGTH,
  TRUNCATE_LIMIT,
  spanPayloadEntries,
  spanPayloadSections,
} from '../span-payloads';

function span(overrides: Partial<TimelineSpan> = {}): TimelineSpan {
  return { spanId: 'a', ...overrides };
}

const labels = (s: TimelineSpan) => spanPayloadSections(s).map(section => section.label);
const section = (s: TimelineSpan, label: string) => spanPayloadSections(s).find(entry => entry.label === label);

describe('spanPayloadSections', () => {
  it('returns nothing for a span with no payload at all', () => {
    expect(spanPayloadSections(span())).toEqual([]);
  });

  it('exposes input, output and metadata as pretty-printed JSON', () => {
    const sections = spanPayloadSections(
      span({ input: { city: 'Paris' }, output: { temp: 21 }, attributes: { finishReason: 'stop' } }),
    );

    expect(sections.map(entry => entry.label)).toEqual(['Input', 'Output', 'Metadata']);
    expect(sections[0]?.json).toBe('{\n  "city": "Paris"\n}');
    expect(sections[1]?.json).toBe('{\n  "temp": 21\n}');
    expect(sections[2]?.json).toBe('{\n  "finishReason": "stop"\n}');
  });

  it('keeps only the sections that carry something', () => {
    expect(labels(span({ output: 'done' }))).toEqual(['Output']);
    expect(labels(span({ input: null, output: undefined, attributes: null }))).toEqual([]);
  });

  it('drops payloads that serialise to an empty object or array', () => {
    expect(labels(span({ input: {}, output: [], attributes: {} }))).toEqual([]);
  });

  it('omits attributes already shown on the row', () => {
    const sections = spanPayloadSections(
      span({
        attributes: {
          model: 'gpt-4o',
          provider: 'openai',
          usage: { inputTokens: 10 },
          costContext: { estimatedCost: 0.1 },
          status: 'success',
          success: true,
        },
      }),
    );

    expect(sections).toEqual([]);
  });

  it('keeps the payloads the row only summarises', () => {
    const json = section(
      span({
        attributes: {
          model: 'gpt-4o',
          tools: [{ name: 'task_write' }],
          messageListMutations: [{ type: 'add' }],
        },
      }),
      'Metadata',
    )?.json;

    expect(json).toContain('task_write');
    expect(json).toContain('messageListMutations');
    expect(json).not.toContain('gpt-4o');
  });

  it('ignores attributes explicitly set to undefined', () => {
    expect(labels(span({ attributes: { finishReason: undefined } }))).toEqual([]);
  });

  it('drops a payload it cannot serialise rather than throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => spanPayloadSections(span({ input: circular, output: 'kept' }))).not.toThrow();
    expect(labels(span({ input: circular, output: 'kept' }))).toEqual(['Output']);
  });

  it('skips syntax highlighting past the highlight limit', () => {
    const small = section(span({ input: { text: 'x' } }), 'Input');
    const large = section(span({ input: { text: 'x'.repeat(HIGHLIGHT_LIMIT) } }), 'Input');

    expect(small?.highlight).toBe(true);
    expect(large?.highlight).toBe(false);
  });

  it('truncates past the truncate limit and says so', () => {
    const large = section(span({ input: { text: 'x'.repeat(TRUNCATE_LIMIT * 2) } }), 'Input');

    expect(large?.json.length).toBeLessThan(TRUNCATE_LIMIT + 100);
    expect(large?.json).toContain('truncated');
  });

  it('keeps only the output on a processor row', () => {
    const processor = span({
      spanType: 'processor_run',
      input: { messages: [] },
      output: { messages: [] },
      attributes: { finishReason: 'stop' },
    });

    expect(labels(processor)).toEqual(['Output']);
  });

  it('leaves the other span types with all three sections', () => {
    const generation = span({
      spanType: 'model_generation',
      input: { messages: [] },
      output: { messages: [] },
      attributes: { finishReason: 'stop' },
    });

    expect(labels(generation)).toEqual(['Input', 'Output', 'Metadata']);
  });

  it('shows no section at all for a processor that produced nothing', () => {
    expect(labels(span({ spanType: 'processor_run', input: { messages: [] }, attributes: { a: 1 } }))).toEqual([]);
  });
});

describe('spanPayloadEntries', () => {
  it('keeps primitives as they read', () => {
    expect(spanPayloadEntries({ reason: 'blocked', count: 2, ok: true })).toEqual([
      { key: 'reason', value: 'blocked' },
      { key: 'count', value: '2' },
      { key: 'ok', value: 'true' },
    ]);
  });

  it('flattens an object value onto a single line', () => {
    expect(spanPayloadEntries({ usage: { inputTokens: 10 } })).toEqual([{ key: 'usage', value: '{"inputTokens":10}' }]);
  });

  it('truncates a value that would run away', () => {
    const [entry] = spanPayloadEntries({ text: 'x'.repeat(MAX_VALUE_LENGTH * 2) });

    expect(entry?.value.length).toBe(MAX_VALUE_LENGTH + 1);
    expect(entry?.value.endsWith('…')).toBe(true);
  });

  it('skips keys with nothing in them', () => {
    expect(spanPayloadEntries({ a: undefined, b: null, c: 'kept' })).toEqual([{ key: 'c', value: 'kept' }]);
  });

  it('drops a key it cannot serialise rather than throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(spanPayloadEntries({ circular, kept: 'yes' })).toEqual([{ key: 'kept', value: 'yes' }]);
  });

  it('returns nothing for a value that is not a plain object', () => {
    expect(spanPayloadEntries('done')).toEqual([]);
    expect(spanPayloadEntries([{ a: 1 }])).toEqual([]);
    expect(spanPayloadEntries(null)).toEqual([]);
    expect(spanPayloadEntries(undefined)).toEqual([]);
  });
});
