/**
 * SendGrid Event Webhook payload types, written by hand from the Event
 * Webhook reference
 * (https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event):
 * SendGrid publishes no machine-readable schema for these events.
 *
 * SendGrid posts events in batches. Connect stores one event per item, so
 * each payload is a single item.
 *
 * Each event has the fields the reference's tables list for it. Custom
 * arguments set when sending arrive as extra top-level properties, which is
 * why every event also accepts unknown keys.
 */

/** SendGrid Event Webhook payloads by Connect event type: the item's `event`. */
export interface SendgridWebhookPayloads {
  account_status_change: SendgridAccountStatusChangeEvent;
  bounce: SendgridBounceEvent;
  click: SendgridClickEvent;
  deferred: SendgridDeferredEvent;
  delivered: SendgridDeliveredEvent;
  dropped: SendgridDroppedEvent;
  group_resubscribe: SendgridGroupResubscribeEvent;
  group_unsubscribe: SendgridGroupUnsubscribeEvent;
  open: SendgridOpenEvent;
  processed: SendgridProcessedEvent;
  spamreport: SendgridSpamReportEvent;
  unsubscribe: SendgridUnsubscribeEvent;
}

/** Fields every message event carries. */
export interface SendgridMessageFields<Event extends string> {
  event: Event;
  /** Address the message was sent to. */
  email: string;
  /** When the event occurred, in Unix seconds. */
  timestamp: number;
  /** SendGrid's id for this event, for deduplication. */
  sg_event_id: string;
  /** SendGrid's id for the message. */
  sg_message_id: string;
  /** Categories set when sending: a string, or an array if sent as one. */
  category?: string | string[];
  /** Arguments set with the SMTP API or v2 Mail Send. */
  unique_args?: Record<string, string>;
  /** Arguments set with v3 Mail Send. */
  custom_args?: Record<string, string>;
  marketing_campaign_id?: number;
  marketing_campaign_name?: string;
  /** The unsubscribe group, when the message has one. */
  asm_group_id?: number;
}

/** A message event, with the custom arguments set when sending. */
export interface SendgridMessageEvent<Event extends string> extends SendgridMessageFields<Event> {
  [customArg: string]: unknown;
}

export interface SendgridProcessedEvent extends SendgridMessageEvent<'processed'> {
  'smtp-id': string;
  /** The IP pool the message was sent from. */
  pool?: { name: string; id: number };
}

export interface SendgridDroppedEvent extends SendgridMessageEvent<'dropped'> {
  'smtp-id': string;
  reason: string;
  /** In the reference's example, though not its table. */
  status?: string;
}

export interface SendgridDeliveredEvent extends SendgridMessageEvent<'delivered'> {
  'smtp-id': string;
  /** IP address the message was sent from. Listed in the reference's table, missing from its example. */
  ip?: string;
  /** The receiving server's response. */
  response: string;
  /** Whether the message was sent over TLS. */
  tls?: boolean | number;
}

export interface SendgridDeferredEvent extends SendgridMessageEvent<'deferred'> {
  'smtp-id': string;
  /** The reference's table lists `reason`; its example carries `response`. */
  reason?: string;
  response?: string;
  /** How many delivery attempts SendGrid has made. */
  attempt: string | number;
}

export interface SendgridBounceEvent extends Omit<SendgridMessageFields<'bounce'>, 'sg_message_id'> {
  [customArg: string]: unknown;
  /** Missing for asynchronous bounces. */
  sg_message_id?: string;
  'smtp-id': string;
  /** `bounce` for a permanent failure; `blocked` for a temporary one. */
  type: 'bounce' | 'blocked';
  reason: string;
  /** The SMTP status code, as `X.Y.Z`. */
  status: string;
  bounce_classification: string;
  tls?: boolean | number;
}

/** Fields of the events for a recipient's engagement. */
export interface SendgridEngagementEvent<Event extends string> extends SendgridMessageEvent<Event> {
  /** The recipient's IP address. */
  ip?: string;
  useragent?: string;
}

export interface SendgridOpenEvent extends SendgridEngagementEvent<'open'> {
  /** Whether Apple Mail Privacy Protection generated the open. */
  sg_machine_open?: boolean;
}

export interface SendgridClickEvent extends SendgridEngagementEvent<'click'> {
  /** The link clicked. */
  url: string;
  /** Which occurrence of the link in the message's HTML was clicked. */
  url_offset?: { index: number; type: string };
}

export type SendgridSpamReportEvent = SendgridMessageEvent<'spamreport'>;
export type SendgridUnsubscribeEvent = SendgridMessageEvent<'unsubscribe'>;

export interface SendgridGroupUnsubscribeEvent extends SendgridEngagementEvent<'group_unsubscribe'> {
  asm_group_id: number;
}

export interface SendgridGroupResubscribeEvent extends SendgridEngagementEvent<'group_resubscribe'> {
  asm_group_id: number;
}

/** SendGrid changed the account's status, for example suspending it. */
export interface SendgridAccountStatusChangeEvent {
  event: 'account_status_change';
  sg_event_id: string;
  timestamp: number;
  /** The new status, for example `compliance_suspend`. */
  type: string;
}
