/**
 * Zod schemas for the MCP Events extension (SEP-3415) wire format.
 *
 * Parsing is deliberately loose: objects tolerate unknown fields and `resultType` is optional, so that
 * revisions of the draft SEP that add fields do not break existing peers.
 *
 * @experimental SEP-3415 is a draft Extensions Track proposal. Shapes may change.
 */
import { z } from 'zod/v4';
import {
  EVENT_DELIVERY_MODES,
  EVENTS_METHODS,
  EVENTS_NOTIFICATIONS,
  EVENTS_SUBSCRIPTION_ID_META_KEY,
} from './constants';

const JsonObjectSchema = z.record(z.string(), z.unknown());
const MetaSchema = JsonObjectSchema.optional();
const CursorSchema = z.string().nullable();
const ResultTypeSchema = z.string().optional();
const RequestIdSchema = z.union([z.string(), z.number()]);

/** `capabilities.extensions["io.modelcontextprotocol/events"]` settings object. */
export const EventsCapabilitySchema = z.looseObject({
  listChanged: z.boolean().optional(),
});

export const EventDeliveryModeSchema = z.enum(EVENT_DELIVERY_MODES);

export const EventDescriptorSchema = z.looseObject({
  name: z.string(),
  description: z.string().optional(),
  // Unknown modes from future revisions are kept as strings and ignored by mode selection.
  delivery: z.array(z.string()).min(1),
  inputSchema: JsonObjectSchema.optional(),
  payloadSchema: JsonObjectSchema.optional(),
  _meta: MetaSchema,
});

export const EventOccurrenceSchema = z.looseObject({
  eventId: z.string(),
  name: z.string(),
  timestamp: z.string(),
  data: JsonObjectSchema,
  cursor: CursorSchema.optional(),
  _meta: MetaSchema,
});

export const EventsErrorSchema = z.looseObject({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

// events/list

export const ListEventsRequestParamsSchema = z.looseObject({
  cursor: z.string().optional(),
  _meta: MetaSchema,
});

export const ListEventsRequestSchema = z.object({
  method: z.literal(EVENTS_METHODS.list),
  params: ListEventsRequestParamsSchema.optional(),
});

export const ListEventsResultSchema = z.looseObject({
  resultType: ResultTypeSchema,
  events: z.array(EventDescriptorSchema),
  nextCursor: z.string().optional(),
  _meta: MetaSchema,
});

// events/poll

const SubscriptionParamsShape = {
  name: z.string(),
  arguments: JsonObjectSchema.optional(),
  cursor: CursorSchema.optional(),
  maxAgeMs: z.number().int().nonnegative().optional(),
  _meta: MetaSchema,
};

export const PollEventsRequestParamsSchema = z.looseObject({
  ...SubscriptionParamsShape,
  maxEvents: z.number().int().positive().optional(),
});

export const PollEventsRequestSchema = z.object({
  method: z.literal(EVENTS_METHODS.poll),
  params: PollEventsRequestParamsSchema,
});

export const PollEventsResultSchema = z.looseObject({
  resultType: ResultTypeSchema,
  events: z.array(EventOccurrenceSchema),
  cursor: CursorSchema,
  truncated: z.boolean().optional(),
  hasMore: z.boolean().optional(),
  nextPollMs: z.number().nonnegative().optional(),
  _meta: MetaSchema,
});

// events/stream

export const StreamEventsRequestParamsSchema = z.looseObject(SubscriptionParamsShape);

export const StreamEventsRequestSchema = z.object({
  method: z.literal(EVENTS_METHODS.stream),
  params: StreamEventsRequestParamsSchema,
});

export const StreamEventsResultSchema = z.looseObject({
  resultType: ResultTypeSchema,
  _meta: MetaSchema,
});

/** `_meta` on every `notifications/events/*` message delivered on a push stream. */
export const StreamNotificationMetaSchema = z.looseObject({
  [EVENTS_SUBSCRIPTION_ID_META_KEY]: RequestIdSchema,
});

export const EventActiveNotificationParamsSchema = z.looseObject({
  cursor: CursorSchema.optional(),
  truncated: z.boolean().optional(),
  _meta: StreamNotificationMetaSchema,
});

export const EventNotificationParamsSchema = EventOccurrenceSchema.extend({
  _meta: StreamNotificationMetaSchema,
});

export const EventHeartbeatNotificationParamsSchema = z.looseObject({
  cursor: CursorSchema.optional(),
  _meta: StreamNotificationMetaSchema,
});

export const EventErrorNotificationParamsSchema = z.looseObject({
  error: EventsErrorSchema,
  _meta: StreamNotificationMetaSchema,
});

export const EventTerminatedNotificationParamsSchema = EventErrorNotificationParamsSchema;

export const EventsListChangedNotificationParamsSchema = z.looseObject({ _meta: MetaSchema }).optional();

export const EventActiveNotificationSchema = z.object({
  method: z.literal(EVENTS_NOTIFICATIONS.active),
  params: EventActiveNotificationParamsSchema,
});
export const EventNotificationSchema = z.object({
  method: z.literal(EVENTS_NOTIFICATIONS.event),
  params: EventNotificationParamsSchema,
});
export const EventHeartbeatNotificationSchema = z.object({
  method: z.literal(EVENTS_NOTIFICATIONS.heartbeat),
  params: EventHeartbeatNotificationParamsSchema,
});
export const EventErrorNotificationSchema = z.object({
  method: z.literal(EVENTS_NOTIFICATIONS.error),
  params: EventErrorNotificationParamsSchema,
});
export const EventTerminatedNotificationSchema = z.object({
  method: z.literal(EVENTS_NOTIFICATIONS.terminated),
  params: EventTerminatedNotificationParamsSchema,
});
export const EventsListChangedNotificationSchema = z.object({
  method: z.literal(EVENTS_NOTIFICATIONS.listChanged),
  params: EventsListChangedNotificationParamsSchema,
});

// events/subscribe and events/unsubscribe (webhook)

/** Standard Webhooks symmetric secret: `whsec_` + base64 of 24 to 64 random bytes. */
export const WebhookSecretSchema = z
  .string()
  .regex(/^whsec_[A-Za-z0-9+/]+={0,2}$/, 'must be "whsec_" followed by base64')
  // Buffer decodes leniently, but strict decoders (atob) reject unpadded or truncated base64.
  .refine(value => (value.length - 'whsec_'.length) % 4 === 0, { message: 'must be padded base64' })
  .refine(
    value => {
      const decoded = Buffer.from(value.slice('whsec_'.length), 'base64').length;
      return decoded >= 24 && decoded <= 64;
    },
    { message: 'must encode 24 to 64 bytes' },
  );

export const WebhookDeliverySchema = z.looseObject({
  mode: z.literal('webhook'),
  url: z.string().url(),
  secret: WebhookSecretSchema,
});

export const SubscribeEventsRequestParamsSchema = z.looseObject({
  ...SubscriptionParamsShape,
  delivery: WebhookDeliverySchema,
  // `null` requests no expiry; omitted means server default.
  ttlMs: z.number().int().positive().nullable().optional(),
});

export const SubscribeEventsRequestSchema = z.object({
  method: z.literal(EVENTS_METHODS.subscribe),
  params: SubscribeEventsRequestParamsSchema,
});

export const WebhookFailureReasonSchema = z.string();

export const WebhookDeliveryStatusSchema = z.looseObject({
  active: z.boolean(),
  lastDeliveryAt: z.string().nullable().optional(),
  lastError: WebhookFailureReasonSchema.nullable().optional(),
  failedSince: z.string().nullable().optional(),
  throttled: z.boolean().optional(),
  retryAfterMs: z.number().int().nonnegative().optional(),
});

export const SubscribeEventsResultSchema = z.looseObject({
  resultType: ResultTypeSchema,
  id: z.string(),
  refreshBefore: z.string().nullable(),
  cursor: CursorSchema,
  truncated: z.boolean().optional(),
  deliveryStatus: WebhookDeliveryStatusSchema.optional(),
  _meta: MetaSchema,
});

export const UnsubscribeEventsRequestParamsSchema = z.looseObject({
  name: z.string(),
  arguments: JsonObjectSchema.optional(),
  delivery: z.looseObject({ url: z.string().url() }),
  _meta: MetaSchema,
});

export const UnsubscribeEventsRequestSchema = z.object({
  method: z.literal(EVENTS_METHODS.unsubscribe),
  params: UnsubscribeEventsRequestParamsSchema,
});

export const UnsubscribeEventsResultSchema = z.looseObject({
  resultType: ResultTypeSchema,
  _meta: MetaSchema,
});

// Webhook POST bodies

export const WebhookGapBodySchema = z.looseObject({
  type: z.literal('gap'),
  cursor: CursorSchema,
});

export const WebhookTerminatedBodySchema = z.looseObject({
  type: z.literal('terminated'),
  error: EventsErrorSchema,
});

export const WebhookVerificationBodySchema = z.looseObject({
  type: z.literal('verification'),
  challenge: z.string(),
});

export const WebhookControlBodySchema = z.discriminatedUnion('type', [
  WebhookGapBodySchema,
  WebhookTerminatedBodySchema,
  WebhookVerificationBodySchema,
]);

/** A body with a top-level `type` field is a control envelope; otherwise it is an occurrence. */
export function parseWebhookBody(
  body: unknown,
):
  | { kind: 'event'; event: z.infer<typeof EventOccurrenceSchema> }
  | { kind: 'control'; control: z.infer<typeof WebhookControlBodySchema> } {
  if (body !== null && typeof body === 'object' && 'type' in body) {
    return { kind: 'control', control: WebhookControlBodySchema.parse(body) };
  }
  return { kind: 'event', event: EventOccurrenceSchema.parse(body) };
}
