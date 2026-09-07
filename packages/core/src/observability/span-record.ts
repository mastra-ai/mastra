import type { SpanRecord } from '../storage/domains/observability/tracing';
import type { SpanType } from './types';

/**
 * Narrows a stored span record to one or more span types, typing its
 * `attributes`, `input` and `output` for that type.
 *
 * The check is on `spanType` only. Payloads are not validated: the typed view
 * trusts that the producer for that span type wrote the shape core declares,
 * the same trust `SpanTypeMap` already places in `attributes`.
 *
 * Kept free of runtime imports so browser bundles that only need the guard
 * do not pull in the rest of the observability utilities.
 *
 * @example
 * if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
 *   span.attributes?.usage; // UsageStats | undefined
 * }
 */
export function isSpanRecordOfType<TType extends SpanType>(
  span: SpanRecord,
  type: TType | readonly TType[],
): span is SpanRecord<TType> {
  return Array.isArray(type) ? type.includes(span.spanType as TType) : span.spanType === type;
}
