import { z } from 'zod/v4';
import { SpanType } from '../../observability';
import { contextFields, dbTimestamps, metadataField, tagsField, traceIdField, spanIdField } from '../shared';

export { traceIdField, spanIdField };

const createOmitKeys = <T extends z.ZodRawShape>(shape: T): { [K in keyof T]: true } =>
  Object.fromEntries(Object.keys(shape).map(k => [k, true])) as { [K in keyof T]: true };

const spanNameField = z.string().describe('Human-readable span name');
const parentSpanIdField = z.string().describe('Parent span reference (null = root span)');
const spanTypeField = z.nativeEnum(SpanType).describe('Span type (e.g., WORKFLOW_RUN, AGENT_RUN, TOOL_CALL, etc.)');
const attributesField = z.record(z.string(), z.unknown()).describe('Span-type specific attributes (e.g., model, tokens, tools)');
const linksField = z.array(z.unknown()).describe('References to related spans in other traces');
const inputField = z.unknown().describe('Input data passed to the span');
const outputField = z.unknown().describe('Output data returned from the span');
const errorField = z.unknown().describe('Error info - presence indicates failure (status derived from this)');
const isEventField = z.boolean().describe('Whether this is an event (point-in-time) vs a span (duration)');
const startedAtField = z.date().describe('When the span started');
const endedAtField = z.date().describe('When the span ended (null = running, status derived from this)');

export enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

const traceStatusField = z.nativeEnum(TraceStatus).describe('Current status of the trace');

const sharedFields = {
  ...contextFields,
  metadata: metadataField.nullish(),
  tags: tagsField.nullish(),
} as const;

export const spanIds = {
  traceId: traceIdField,
  spanId: spanIdField,
} as const satisfies z.ZodRawShape;

export const spanIdsSchema = z.object({
  ...spanIds,
});

export type SpanIds = z.infer<typeof spanIdsSchema>;

const omitDbTimestamps = createOmitKeys(dbTimestamps);
const omitSpanIds = createOmitKeys(spanIds);
void omitDbTimestamps;
void omitSpanIds;

export const spanRecordSchema = z
  .object({
    ...spanIds,
    name: spanNameField,
    spanType: spanTypeField,
    isEvent: isEventField,
    startedAt: startedAtField,
    parentSpanId: parentSpanIdField.nullish(),
    ...sharedFields,
    experimentId: z.string().nullish().describe('Experiment or eval run identifier'),
    attributes: attributesField.nullish(),
    links: linksField.nullish(),
    input: inputField.nullish(),
    output: outputField.nullish(),
    error: errorField.nullish(),
    endedAt: endedAtField.nullish(),
    requestContext: z.record(z.string(), z.unknown()).nullish().describe('Request context data'),
    ...dbTimestamps,
  })
  .describe('Span record data');

export type SpanRecord = z.infer<typeof spanRecordSchema>;

export function computeTraceStatus(span: SpanRecord): TraceStatus {
  if (span.error != null) return TraceStatus.ERROR;
  if (span.endedAt == null) return TraceStatus.RUNNING;
  return TraceStatus.SUCCESS;
}

export const traceSpanSchema = spanRecordSchema.extend({
  status: traceStatusField,
});

export type TraceSpan = z.infer<typeof traceSpanSchema>;
