import { describe, expect, expectTypeOf, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { isSpanRecordOfType } from './span-record';
import type { AgentRunInput, ModelGenerationInput, UsageStats } from './types';
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

  it('types the payload fields of the narrowed record', () => {
    const span = record(SpanType.MODEL_GENERATION, { usage: { inputTokens: 1 } });

    // Before narrowing the payload fields are untyped.
    expectTypeOf(span.input).toEqualTypeOf<unknown>();
    expectTypeOf(span.attributes).toEqualTypeOf<Record<string, unknown> | null | undefined>();

    if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
      expectTypeOf(span.spanType).toEqualTypeOf<SpanType.MODEL_GENERATION>();
      expectTypeOf(span.input).toEqualTypeOf<ModelGenerationInput | null | undefined>();
      expectTypeOf(span.attributes?.usage).toEqualTypeOf<UsageStats | undefined>();
      expect(span.attributes?.usage?.inputTokens).toBe(1);
    }

    if (isSpanRecordOfType(span, SpanType.AGENT_RUN)) {
      expectTypeOf(span.input).toEqualTypeOf<AgentRunInput | null | undefined>();
    }
  });
});
