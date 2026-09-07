import { describe, expect, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { isSpanRecordOfType } from './span-record';
import { SpanType } from './types';

describe('isSpanRecordOfType', () => {
  const record = (spanType: SpanType, attributes: Record<string, unknown> = {}): SpanRecord =>
    ({ traceId: 't', spanId: 's', spanType, attributes }) as unknown as SpanRecord;

  it('matches a single span type', () => {
    expect(isSpanRecordOfType(record(SpanType.MODEL_GENERATION), SpanType.MODEL_GENERATION)).toBe(true);
    expect(isSpanRecordOfType(record(SpanType.AGENT_RUN), SpanType.MODEL_GENERATION)).toBe(false);
  });

  it('matches any span type in a list', () => {
    const modelTypes = [SpanType.MODEL_GENERATION, SpanType.MODEL_STEP] as const;

    expect(isSpanRecordOfType(record(SpanType.MODEL_STEP), modelTypes)).toBe(true);
    expect(isSpanRecordOfType(record(SpanType.TOOL_CALL), modelTypes)).toBe(false);
    expect(isSpanRecordOfType(record(SpanType.TOOL_CALL), [])).toBe(false);
  });

  it('reads the typed payload of the narrowed record', () => {
    const span = record(SpanType.MODEL_GENERATION, { usage: { inputTokens: 1 } });

    if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
      expect(span.attributes?.usage?.inputTokens).toBe(1);
    } else {
      expect.unreachable('span should narrow to MODEL_GENERATION');
    }
  });
});
