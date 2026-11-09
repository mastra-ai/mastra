import { describe, expect, it } from 'vitest';
import { formatTraceparent, parseTraceparent } from './w3c';

const TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
const SPAN_ID = 'b7ad6b7169203331';

describe('parseTraceparent', () => {
  it('parses a valid traceparent, ignoring surrounding whitespace', () => {
    expect(parseTraceparent(` 00-${TRACE_ID}-${SPAN_ID}-01 `)).toEqual({
      version: '00',
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      flags: '01',
    });
  });

  it.each([
    ['a non-string value', 42],
    ['undefined', undefined],
    ['garbage', 'garbage'],
    ['uppercase hex', `00-${TRACE_ID.toUpperCase()}-${SPAN_ID}-01`],
    ['the invalid version ff', `ff-${TRACE_ID}-${SPAN_ID}-01`],
    ['an all-zero trace id', `00-${'0'.repeat(32)}-${SPAN_ID}-01`],
    ['an all-zero span id', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
  ])('returns null for %s', (_label, value) => {
    expect(parseTraceparent(value)).toBeNull();
  });
});

describe('formatTraceparent', () => {
  it('formats sampled and unsampled traceparents that parse back', () => {
    expect(formatTraceparent(TRACE_ID, SPAN_ID, true)).toBe(`00-${TRACE_ID}-${SPAN_ID}-01`);
    expect(formatTraceparent(TRACE_ID, SPAN_ID, false)).toBe(`00-${TRACE_ID}-${SPAN_ID}-00`);
    expect(parseTraceparent(formatTraceparent(TRACE_ID, SPAN_ID, true))?.spanId).toBe(SPAN_ID);
  });
});
