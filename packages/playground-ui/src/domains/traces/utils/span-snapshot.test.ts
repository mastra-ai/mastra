import { describe, expect, it } from 'vitest';

import { createSpanSnapshotIndex, getTimelineEvents, snapshotKeyAt, snapshotSpansAt } from './span-snapshot';

const at = (ms: number) => new Date(Date.UTC(2026, 5, 1, 10) + ms);
const T0 = at(0).getTime();

const spans = [
  { id: 'root', startedAt: at(0), endedAt: at(1000), output: { text: 'done' }, error: null },
  { id: 'tool', startedAt: at(200), endedAt: at(400), output: { ok: true }, error: null },
  { id: 'late', startedAt: at(600), endedAt: at(900), output: { late: true }, error: { message: 'boom' } },
  { id: 'live', startedAt: at(700), endedAt: null, output: undefined, error: undefined },
];

describe('snapshotSpansAt', () => {
  it('drops spans that start after the cursor', () => {
    expect(snapshotSpansAt(spans, T0 + 500).map(span => span.id)).toEqual(['root', 'tool']);
  });

  it('masks the end, output and error of spans still running at the cursor', () => {
    const [root] = snapshotSpansAt(spans, T0 + 500);
    expect(root).toEqual({ id: 'root', startedAt: at(0), endedAt: null, output: undefined, error: undefined });

    const late = snapshotSpansAt(spans, T0 + 800).find(span => span.id === 'late');
    expect(late).toMatchObject({ endedAt: null, output: undefined, error: undefined });
  });

  it('keeps ended spans untouched', () => {
    const tool = snapshotSpansAt(spans, T0 + 500).find(span => span.id === 'tool');
    expect(tool).toBe(spans[1]);
  });

  it('counts a span as started and ended exactly at its boundaries', () => {
    expect(snapshotSpansAt(spans, T0 + 200).map(span => span.id)).toEqual(['root', 'tool']);
    expect(snapshotSpansAt(spans, T0 + 400).find(span => span.id === 'tool')).toBe(spans[1]);
  });

  it('treats spans without an end as running at any time', () => {
    const live = snapshotSpansAt(spans, T0 + 10_000).find(span => span.id === 'live');
    expect(live?.endedAt).toBeNull();
  });

  it('accepts ISO string timestamps', () => {
    const [span] = snapshotSpansAt(
      [{ startedAt: at(0).toISOString(), endedAt: at(100).toISOString(), output: 1 }],
      T0 + 50,
    );
    expect(span).toMatchObject({ endedAt: null, output: undefined });
  });
});

describe('snapshotKeyAt', () => {
  const index = createSpanSnapshotIndex(spans);

  it('stays the same between two span boundaries', () => {
    expect(snapshotKeyAt(index, T0 + 210)).toBe(snapshotKeyAt(index, T0 + 390));
  });

  it('changes when a span starts or ends', () => {
    expect(snapshotKeyAt(index, T0 + 199)).toBe('1:0');
    expect(snapshotKeyAt(index, T0 + 200)).toBe('2:0');
    expect(snapshotKeyAt(index, T0 + 400)).toBe('2:1');
    expect(snapshotKeyAt(index, T0 + 1000)).toBe('4:3');
  });

  it('is empty before the trace starts', () => {
    expect(snapshotKeyAt(index, T0 - 1)).toBe('0:0');
  });
});

describe('getTimelineEvents', () => {
  it('lists every distinct start and end in order', () => {
    const iso = (ms: number) => at(ms).toISOString();
    expect(
      getTimelineEvents([
        { startTime: iso(0), latency: 1000, endTime: iso(1000) },
        { startTime: iso(200), latency: 800, endTime: iso(1000) },
        { startTime: iso(0), latency: 0 },
      ]),
    ).toEqual([T0, T0 + 200, T0 + 1000]);
  });
});
