import { describe, expect, it } from 'vitest';

import { formatBaggage, formatTraceparent, parseBaggage, parseTraceparent } from './w3c';

describe('w3c traceparent', () => {
  it('formats sampled traceparent', () => {
    const traceId = '0af7651916cd43dd8448eb211c80319c';
    const spanId = 'b7ad6b7169203331';
    expect(formatTraceparent(traceId, spanId, true)).toBe(`00-${traceId}-${spanId}-01`);
    expect(formatTraceparent(traceId, spanId, false)).toBe(`00-${traceId}-${spanId}-00`);
  });

  it('parses a valid traceparent', () => {
    const parsed = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    expect(parsed).toEqual({
      version: '00',
      traceId: '0af7651916cd43dd8448eb211c80319c',
      spanId: 'b7ad6b7169203331',
      flags: '01',
    });
  });

  it('returns null for malformed traceparents', () => {
    expect(parseTraceparent(undefined)).toBeNull();
    expect(parseTraceparent('')).toBeNull();
    expect(parseTraceparent('not-a-traceparent')).toBeNull();
    // wrong number of bytes
    expect(parseTraceparent('00-0af7651916cd43dd-b7ad6b7169203331-01')).toBeNull();
    // non-hex characters
    expect(parseTraceparent('00-zzf7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')).toBeNull();
  });

  it('roundtrips format -> parse', () => {
    const traceId = '11111111111111111111111111111111';
    const spanId = '2222222222222222';
    const parsed = parseTraceparent(formatTraceparent(traceId, spanId, true));
    expect(parsed?.traceId).toBe(traceId);
    expect(parsed?.spanId).toBe(spanId);
    expect(parsed?.flags).toBe('01');
  });
});

describe('w3c baggage', () => {
  it('parses simple baggage', () => {
    const out = parseBaggage('key1=value1,key2=value2');
    expect(out.get('key1')).toBe('value1');
    expect(out.get('key2')).toBe('value2');
  });

  it('strips properties after semicolons', () => {
    const out = parseBaggage('key=value;property=ignored,other=here');
    expect(out.get('key')).toBe('value');
    expect(out.get('other')).toBe('here');
  });

  it('percent-decodes values', () => {
    const out = parseBaggage('key=hello%20world');
    expect(out.get('key')).toBe('hello world');
  });

  it('handles empty and undefined input', () => {
    expect(parseBaggage(undefined).size).toBe(0);
    expect(parseBaggage('').size).toBe(0);
  });

  it('formats Map and Record forms identically', () => {
    const map = new Map([
      ['k1', 'v1'],
      ['k2', 'v 2'],
    ]);
    const record = { k1: 'v1', k2: 'v 2' };
    expect(formatBaggage(map)).toBe(formatBaggage(record));
  });

  it('percent-encodes values when formatting', () => {
    expect(formatBaggage({ key: 'hello world' })).toBe('key=hello%20world');
  });

  it('roundtrips format -> parse', () => {
    const original = new Map([
      ['mastra.tracingPolicy', 'on'],
      ['mastra.runId', 'abc-123'],
    ]);
    const formatted = formatBaggage(original);
    const parsed = parseBaggage(formatted);
    expect(parsed.get('mastra.tracingPolicy')).toBe('on');
    expect(parsed.get('mastra.runId')).toBe('abc-123');
  });
});
