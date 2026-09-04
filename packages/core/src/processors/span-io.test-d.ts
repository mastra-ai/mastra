import { describe, expectTypeOf, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import type {
  ProcessorInputStepSpanInput,
  ProcessorInputStepSpanOutput,
  ProcessorSpanIOPhase,
  ProjectedSpanPayload,
  SpanProjection,
} from './span-io';
import { isProcessorSpan } from './span-io';
import type { ProcessInputStepArgs } from './index';

describe('span-io types', () => {
  it('isProcessorSpan narrows input/output to the phase payload types', () => {
    const span = {} as SpanRecord;
    if (isProcessorSpan(span, 'inputStep')) {
      expectTypeOf(span.input).toEqualTypeOf<ProcessorInputStepSpanInput | null | undefined>();
      expectTypeOf(span.output).toEqualTypeOf<ProcessorInputStepSpanOutput | null | undefined>();
    }
  });

  type Source = { a: string; b?: number; c: () => void; d: Date };

  it('ProjectedSpanPayload drops omit, keeps keep, makes optional optional, substitutes summary', () => {
    const spec = {
      a: 'keep',
      b: 'optional',
      c: 'omit',
      d: { summary: undefined as unknown as string },
    } as const satisfies SpanProjection<Source>;

    type Projected = ProjectedSpanPayload<Source, typeof spec>;
    expectTypeOf<Projected>().toEqualTypeOf<{ a: string; b?: number; d?: string }>();
  });

  it('rejects a spec that misses a source key (the drift lock)', () => {
    // @ts-expect-error — `d` is not classified
    const _missing = { a: 'keep', b: 'omit', c: 'omit' } as const satisfies SpanProjection<Source>;
    void _missing;
  });

  it('rejects a spec with a key that no longer exists on the source', () => {
    const _extra = {
      a: 'keep',
      b: 'omit',
      c: 'omit',
      d: 'omit',
      // @ts-expect-error — `zzz` is not a key of Source
      zzz: 'keep',
    } as const satisfies SpanProjection<Source>;
    void _extra;
  });

  it('SpanProjection requires every ProcessInputStepArgs key', () => {
    expectTypeOf<keyof SpanProjection<ProcessInputStepArgs>>().toEqualTypeOf<keyof ProcessInputStepArgs>();
  });

  it('phase union is closed', () => {
    expectTypeOf<ProcessorSpanIOPhase>().toEqualTypeOf<
      'input' | 'inputStep' | 'output' | 'outputStep' | 'toolResult'
    >();
  });
});
