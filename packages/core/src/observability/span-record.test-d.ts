import { describe, expectTypeOf, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { describeSpanError, describeSpanInput, describeSpanOutput, isSpanRecordOfType } from './span-record';
import type {
  AgentRunInput,
  AgentRunResult,
  AgentRunResumeInput,
  InterruptedSpanOutput,
  ModelGenerationInput,
  ModelGenerationResult,
  ModelStepInput,
  ModelStepOutput,
  ModelStepResult,
  SpanErrorInfo,
  UsageStats,
} from './types';
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

    if (isSpanRecordOfType(span, SpanType.MODEL_INFERENCE)) {
      expectTypeOf(span.input).toEqualTypeOf<ModelStepInput | null | undefined>();
      expectTypeOf(span.output).toEqualTypeOf<ModelStepResult | null | undefined>();
    }

    if (isSpanRecordOfType(span, SpanType.TOOL_CALL)) {
      // Span types without a mapped payload keep `any`, exactly as before.
      expectTypeOf(span.input).toBeAny();
      expectTypeOf(span.output).toBeAny();
      expectTypeOf(span.attributes?.success).toEqualTypeOf<boolean | undefined>();
    }

    if (isSpanRecordOfType(span, [SpanType.MODEL_GENERATION, SpanType.MODEL_STEP] as const)) {
      expectTypeOf(span.attributes?.finishReason).toEqualTypeOf<string | undefined>();
      // The narrowed record is a union, so `spanType` keeps discriminating.
      if (span.spanType === SpanType.MODEL_STEP) {
        expectTypeOf(span.output).toEqualTypeOf<ModelStepOutput | null | undefined>();
      }
    }
  });
});

describe('describeSpan* types', () => {
  it('narrows the tagged payload on its type field', () => {
    const span = {} as SpanRecord;
    const input = describeSpanInput(span);
    const output = describeSpanOutput(span);

    expectTypeOf(describeSpanError(span)).toEqualTypeOf<SpanErrorInfo | undefined>();

    if (input?.type === 'text') expectTypeOf(input.value).toEqualTypeOf<string>();
    if (input?.type === 'agent-run-resume') expectTypeOf(input.value).toEqualTypeOf<AgentRunResumeInput>();
    if (input?.type === 'json') expectTypeOf(input.value).toEqualTypeOf<unknown>();

    if (output?.type === 'interrupted') expectTypeOf(output.value).toEqualTypeOf<InterruptedSpanOutput>();
    if (output?.type === 'agent-run-result') expectTypeOf(output.value).toEqualTypeOf<AgentRunResult>();
    if (output?.type === 'model-generation-result') expectTypeOf(output.value).toEqualTypeOf<ModelGenerationResult>();
    if (output?.type === 'model-step-result') expectTypeOf(output.value).toEqualTypeOf<ModelStepResult>();
  });
});
