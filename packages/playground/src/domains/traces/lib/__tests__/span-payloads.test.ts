import { describe, expect, it } from 'vitest';

import type { TimelineSpan } from '../build-thread-timeline';
import { HIGHLIGHT_LIMIT, TRUNCATE_LIMIT, spanPayloadSections } from '../span-payloads';

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

  it('leaves the other span types with all three sections', () => {
    const generation = span({
      spanType: 'model_generation',
      input: { messages: [] },
      output: { messages: [] },
      attributes: { finishReason: 'stop' },
    });

    expect(labels(generation)).toEqual(['Input', 'Output', 'Metadata']);
  });
});
