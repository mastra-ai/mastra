import { SpanType, describeSpanInput } from '@mastra/core/observability';
import type { ProcessorRunInputByPhase, ProcessorSpanPayload } from '@mastra/core/observability';
import type { ComponentType } from 'react';
import type { SpanRecord } from '../../types';
import { getSpanSignal } from '@/domains/traces/utils/span-signal';

type CoreSpanRecord = Parameters<typeof describeSpanInput>[0];

type Described = { type: string; value: unknown };

/** A component per description tag, typed against the value that tag carries. */
export type PayloadRegistry<D extends Described> = {
  [T in D['type']]: ComponentType<{ value: Extract<D, { type: T }>['value'] }>;
};

/**
 * Picks the registry entry for `description.type`. The registry is exhaustive by type,
 * so the entry always exists; the cast only erases the per-tag prop refinement TS cannot
 * carry through an indexed lookup.
 */
export function pickRenderer<D extends Described>(
  registry: PayloadRegistry<D>,
  description: D,
): ComponentType<{ value: D['value'] }> {
  return registry[description.type as D['type']] as ComponentType<{ value: D['value'] }>;
}

/**
 * The client-js span (API response: ISO-string dates, string-literal enums) is the core
 * span over the wire. `describeSpan*` only read `spanType`, `metadata`, `input`, `output`
 * and `error`, which are identical in both, so this is the one place the two types meet.
 */
export function asCoreSpan(span: SpanRecord): CoreSpanRecord {
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Generated SDK and core span types differ once workspace declarations are built.
  return span as unknown as CoreSpanRecord;
}

export const hasItems = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

/** Whether a span's input has a rendered preview, rather than only its raw JSON. */
export function hasSpanInputPreview(span: SpanRecord): boolean {
  return getSpanSignal(span) !== undefined || describeSpanInput(asCoreSpan(span))?.type !== 'json';
}

const isEmptyObject = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

/** The output to show, or `undefined` for a processor that returned nothing (stored as `{}`). */
export function getSpanOutputPayload(span: SpanRecord): unknown {
  if (span.spanType === SpanType.PROCESSOR_RUN && isEmptyObject(span.output)) return undefined;
  return span.output;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export interface ProcessorRunContext {
  stepNumber?: number;
  retryCount?: number;
}

/**
 * Where in the generation the hook ran. The runner hands both values to every
 * hook, so they are recorded in `input`, but they describe the run rather than
 * what the processor read: Attributes shows them and the input preview skips them.
 * A key is present only when it holds a number, so a malformed value stays in the input.
 */
export function getProcessorRunContext(input: ProcessorSpanPayload<ProcessorRunInputByPhase>): ProcessorRunContext {
  const { data } = input;
  const stepNumber = 'stepNumber' in data ? data.stepNumber : undefined;
  const retryCount = 'retryCount' in data ? data.retryCount : undefined;
  return {
    ...(isCount(stepNumber) ? { stepNumber } : {}),
    ...(isCount(retryCount) ? { retryCount } : {}),
  };
}
