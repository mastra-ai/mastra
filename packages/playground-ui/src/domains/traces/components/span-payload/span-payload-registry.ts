import type { describeSpanInput } from '@mastra/core/observability';
import type { ComponentType } from 'react';
import type { SpanRecord } from '../../types';

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
  return span as unknown as CoreSpanRecord;
}
