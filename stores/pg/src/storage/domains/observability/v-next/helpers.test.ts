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
