/**
 * Types for the MCP Events extension (SEP-3415) wire format.
 *
 * @experimental SEP-3415 is a draft Extensions Track proposal. Shapes may change.
 */
import type { z } from 'zod/v4';
import type { EVENT_DELIVERY_MODES, EVENTS_ERROR_CODES, WEBHOOK_FAILURE_REASONS } from './constants';
import type {
  EventActiveNotificationParamsSchema,
  EventDescriptorSchema,
  EventErrorNotificationParamsSchema,
  EventHeartbeatNotificationParamsSchema,
  EventNotificationParamsSchema,
  EventOccurrenceSchema,
  EventsCapabilitySchema,
  EventsErrorSchema,
  EventTerminatedNotificationParamsSchema,
  ListEventsRequestParamsSchema,
  ListEventsResultSchema,
  PollEventsRequestParamsSchema,
  PollEventsResultSchema,
  StreamEventsRequestParamsSchema,
  StreamEventsResultSchema,
  SubscribeEventsRequestParamsSchema,
  SubscribeEventsResultSchema,
  UnsubscribeEventsRequestParamsSchema,
  UnsubscribeEventsResultSchema,
  WebhookControlBodySchema,
  WebhookDeliveryStatusSchema,
} from './schemas';

export type EventDeliveryMode = (typeof EVENT_DELIVERY_MODES)[number];
export type EventsErrorCode = (typeof EVENTS_ERROR_CODES)[keyof typeof EVENTS_ERROR_CODES];
export type WebhookFailureReason = (typeof WEBHOOK_FAILURE_REASONS)[number];

export type EventsCapability = z.infer<typeof EventsCapabilitySchema>;
export type EventDescriptor = z.infer<typeof EventDescriptorSchema>;
export type EventOccurrence = z.infer<typeof EventOccurrenceSchema>;
export type EventsError = z.infer<typeof EventsErrorSchema>;

export type ListEventsRequestParams = z.infer<typeof ListEventsRequestParamsSchema>;
export type ListEventsResult = z.infer<typeof ListEventsResultSchema>;
export type PollEventsRequestParams = z.infer<typeof PollEventsRequestParamsSchema>;
export type PollEventsResult = z.infer<typeof PollEventsResultSchema>;
export type StreamEventsRequestParams = z.infer<typeof StreamEventsRequestParamsSchema>;
export type StreamEventsResult = z.infer<typeof StreamEventsResultSchema>;
export type SubscribeEventsRequestParams = z.infer<typeof SubscribeEventsRequestParamsSchema>;
export type SubscribeEventsResult = z.infer<typeof SubscribeEventsResultSchema>;
export type UnsubscribeEventsRequestParams = z.infer<typeof UnsubscribeEventsRequestParamsSchema>;
export type UnsubscribeEventsResult = z.infer<typeof UnsubscribeEventsResultSchema>;
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;
export type WebhookControlBody = z.infer<typeof WebhookControlBodySchema>;

export type EventActiveNotificationParams = z.infer<typeof EventActiveNotificationParamsSchema>;
export type EventNotificationParams = z.infer<typeof EventNotificationParamsSchema>;
export type EventHeartbeatNotificationParams = z.infer<typeof EventHeartbeatNotificationParamsSchema>;
export type EventErrorNotificationParams = z.infer<typeof EventErrorNotificationParamsSchema>;
export type EventTerminatedNotificationParams = z.infer<typeof EventTerminatedNotificationParamsSchema>;

/** Field this extension adds to the `subscriptions/listen` notifications filter. */
export interface EventsSubscriptionFilter {
  eventsListChanged?: boolean;
}
