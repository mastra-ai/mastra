import { describe, expectTypeOf, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { isSpanRecordOfType } from './span-record';
import type { AgentRunInput, ModelGenerationInput, ModelStepInput, ModelStepOutput, UsageStats } from './types';
import { SpanType } from './types';

describe('isSpanRecordOfType types', () => {
  it('types the payload fields of the narrowed record', () => {
    const span = {} as SpanRecord;

    // Before narrowing the payload fields are untyped.
    expectTypeOf(span.input).toEqualTypeOf<unknown>();
    expectTypeOf(span.attributes).toEqualTypeOf<Record<string, unknown> | null | undefined>();

    if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
      expectTypeOf(span.spanType).toEqualTypeOf<SpanType.MODEL_GENERATION>();
      expectTypeOf(span.input).toEqualTypeOf<ModelGenerationInput | null | undefined>();
      expectTypeOf(span.attributes?.usage).toEqualTypeOf<UsageStats | undefined>();
    }

    if (isSpanRecordOfType(span, SpanType.AGENT_RUN)) {
      expectTypeOf(span.input).toEqualTypeOf<AgentRunInput | null | undefined>();
    }

    if (isSpanRecordOfType(span, SpanType.MODEL_STEP)) {
      expectTypeOf(span.input).toEqualTypeOf<ModelStepInput | null | undefined>();
      expectTypeOf(span.output).toEqualTypeOf<ModelStepOutput | null | undefined>();
    }

    if (isSpanRecordOfType(span, SpanType.TOOL_CALL)) {
      // Span types without a mapped payload keep `any`, exactly as before.
      expectTypeOf(span.input).toBeAny();
      expectTypeOf(span.output).toBeAny();
      expectTypeOf(span.attributes?.success).toEqualTypeOf<boolean | undefined>();
    }

    if (isSpanRecordOfType(span, [SpanType.MODEL_GENERATION, SpanType.MODEL_STEP] as const)) {
      expectTypeOf(span.attributes?.finishReason).toEqualTypeOf<string | undefined>();
    }
  });
});
