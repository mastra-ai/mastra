import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { rowToSpanRecord, spanRecordToRow } from './helpers';

// The pg driver decodes jsonb columns into native JS values before the reader
// sees them. These tests simulate that decoded row and assert that
// `rowToSpanRecord` preserves scalar strings (including JSON-looking ones),
// objects, and arrays without dropping or coercing them. Regression guard for
// https://github.com/mastra-ai/mastra/issues/23575.

function makeRow(input: unknown, output: unknown): Record<string, any> {
  const startedAt = new Date('2026-01-01T00:00:00.000Z');
  const endedAt = new Date('2026-01-01T00:00:01.000Z');
  const row = spanRecordToRow({
    traceId: 'trace-1',
    spanId: 'span-1',
    name: 'string-step',
    spanType: SpanType.WORKFLOW_STEP,
    isEvent: false,
    startedAt,
    endedAt,
    serviceName: 'svc',
    environment: 'test',
  } as any) as Record<string, any>;
  // Override the jsonb payloads with driver-decoded values under test.
  row.input = input;
  row.output = output;
  return row;
}

describe('rowToSpanRecord jsonb payload round-trip', () => {
  it('preserves plain scalar strings', () => {
    const record = rowToSpanRecord(makeRow('hello', 'world'));
    expect(record.input).toBe('hello');
    expect(record.output).toBe('world');
  });

  it('does not coerce JSON-looking numeric strings', () => {
    const record = rowToSpanRecord(makeRow('123', '123'));
    expect(record.input).toBe('123');
    expect(record.output).toBe('123');
    expect(typeof record.output).toBe('string');
  });

  it('does not coerce JSON-looking boolean strings', () => {
    const record = rowToSpanRecord(makeRow('true', 'false'));
    expect(record.input).toBe('true');
    expect(record.output).toBe('false');
    expect(typeof record.output).toBe('string');
  });

  it('preserves object payloads', () => {
    const output = { message: 'hi', nested: { n: 1 } };
    const record = rowToSpanRecord(makeRow({ a: 1 }, output));
    expect(record.input).toEqual({ a: 1 });
    expect(record.output).toEqual(output);
  });

  it('preserves array payloads', () => {
    const record = rowToSpanRecord(makeRow([1, 2, 3], ['a', 'b']));
    expect(record.input).toEqual([1, 2, 3]);
    expect(record.output).toEqual(['a', 'b']);
  });

  it('maps null payloads to undefined', () => {
    const record = rowToSpanRecord(makeRow(null, null));
    expect(record.input).toBeUndefined();
    expect(record.output).toBeUndefined();
  });
});

describe('span usage columns round-trip (OBS-381)', () => {
  const base = {
    traceId: 'trace-usage',
    spanId: 'span-usage',
    name: 'model call',
    spanType: SpanType.MODEL_GENERATION,
    isEvent: false,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    endedAt: new Date('2026-01-01T00:00:01.000Z'),
  };

  it('writes usage fields to the row and coerces pg int8 strings back to numbers', () => {
    const row = spanRecordToRow({
      ...base,
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      reasoningTokens: 10,
      cachedTokens: 0,
      estimatedCost: 0.00123,
      costUnit: 'usd',
    }) as Record<string, any>;
    expect(row).toMatchObject({ inputTokens: 120, cachedTokens: 0, estimatedCost: 0.00123, costUnit: 'usd' });

    // Simulate the driver: bigint (int8) columns arrive as strings, double precision as numbers.
    const driverRow = {
      ...row,
      inputTokens: '120',
      outputTokens: '30',
      totalTokens: '150',
      reasoningTokens: '10',
      cachedTokens: '0',
      estimatedCost: 0.00123,
    };
    const record = rowToSpanRecord(driverRow);
    expect(record).toMatchObject({
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      reasoningTokens: 10,
      cachedTokens: 0,
      estimatedCost: 0.00123,
      costUnit: 'usd',
    });
    expect(typeof record.inputTokens).toBe('number');
  });

  it('writes and reads null usage when the span carries none', () => {
    const row = spanRecordToRow(base) as Record<string, any>;
    const record = rowToSpanRecord(row);
    for (const key of [
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'reasoningTokens',
      'cachedTokens',
      'estimatedCost',
      'costUnit',
    ] as const) {
      expect(row[key]).toBeNull();
      expect(record[key]).toBeNull();
    }
  });
});
