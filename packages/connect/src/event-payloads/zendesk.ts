/**
 * Zendesk webhook payload types, written by hand from Zendesk's event
 * references for tickets
 * (https://developer.zendesk.com/api-reference/webhooks/event-types/ticket-events/),
 * users (.../user-events/) and organizations (.../organization-events/):
 * Zendesk's OpenAPI description doesn't cover webhook events.
 *
 * These are the events Connect subscribes Zendesk connections to. Ids in
 * `detail` and `event` arrive as strings. Where a reference's table and its
 * sample disagree on a type, both are allowed.
 */

/** A Zendesk event webhook body. */
export interface ZendeskWebhook<Type extends string, Detail, Event> {
  type: `zen:event-type:${Type}`;
  /** The Zendesk account the event happened in. */
  account_id: number;
  /** Zendesk's id for the event. */
  id: string;
  /** When the event happened, as ISO 8601. */
  time: string;
  /** For example `2022-11-06`. */
  zendesk_event_version: string;
  /** What the event is about, such as `zen:ticket:342757`. */
  subject: string;
  /** The resource's state after the event. */
  detail: Detail;
  /** What changed. */
  event: Event;
}

/** Where a ticket event falls among the events of one change. */
export interface ZendeskEventMeta {
  /** Zendesk's field table says number, but its examples send strings too. */
  sequence: { id: string | number; position: number };
}

type ZendeskChange<Value> = { current: Value; previous: Value; meta: ZendeskEventMeta };

export interface ZendeskTicketDetail {
  actor_id: string;
  assignee_id: string | null;
  brand_id: string;
  created_at: string;
  custom_status: string | null;
  description: string;
  external_id: string | null;
  form_id: string | null;
  group_id: string | null;
  id: string;
  is_public: boolean;
  organization_id: string | null;
  /** For example `URGENT`. */
  priority: string | null;
  requester_id: string;
  /** For example `OPEN`. */
  status: string;
  subject: string;
  submitter_id: string;
  tags: string[] | null;
  type: string | null;
  updated_at: string;
  via: { channel: string };
}

export interface ZendeskUserDetail {
  created_at: string;
  email: string;
  external_id: string | null;
  default_group_id: string;
  id: string;
  organization_id: string;
  /** For example `end-user`. */
  role: string;
  /** The brand the user belongs to, when it's a separated brand. */
  separation_brand_id?: string;
  updated_at: string;
}

export interface ZendeskOrganizationDetail {
  created_at: string;
  external_id: string | null;
  group_id: string | null;
  id: string;
  name: string;
  shared_comments: boolean;
  shared_tickets: boolean;
  updated_at: string;
}

export interface ZendeskComment {
  id: string | number;
  body: string;
  html_body: string;
  is_public: boolean;
  author: { id: string | number; is_staff: boolean; name: string };
}

type TicketEvent<Type extends string, Event> = ZendeskWebhook<`ticket.${Type}`, ZendeskTicketDetail, Event>;
type TicketChange<Type extends string, Value = string | null> = TicketEvent<Type, ZendeskChange<Value>>;
type Meta = { meta: ZendeskEventMeta };

/** Zendesk webhook payloads by Connect event type: the body's `type`. */
export interface ZendeskWebhookPayloads {
  'zen:event-type:organization.created': ZendeskWebhook<
    'organization.created',
    ZendeskOrganizationDetail,
    Record<string, never>
  >;
  'zen:event-type:organization.deleted': ZendeskWebhook<
    'organization.deleted',
    ZendeskOrganizationDetail,
    Record<string, never>
  >;
  /** Agent, group and custom status ids: numbers in Zendesk's field table, strings in its examples. */
  'zen:event-type:ticket.agent_assignment_changed': TicketChange<'agent_assignment_changed', string | number | null>;
  'zen:event-type:ticket.comment_added': TicketEvent<'comment_added', Meta & { comment: ZendeskComment }>;
  'zen:event-type:ticket.created': TicketEvent<'created', Meta>;
  'zen:event-type:ticket.custom_status_changed': TicketChange<'custom_status_changed', string | number | null>;
  'zen:event-type:ticket.group_assignment_changed': TicketChange<'group_assignment_changed', string | number | null>;
  'zen:event-type:ticket.merged': TicketEvent<
    'merged',
    Meta & { /** The ticket this one was merged into. */ target_ticket_id: string | number }
  >;
  'zen:event-type:ticket.priority_changed': TicketChange<'priority_changed'>;
  'zen:event-type:ticket.soft_deleted': TicketEvent<'soft_deleted', Meta>;
  'zen:event-type:ticket.status_changed': TicketChange<'status_changed'>;
  'zen:event-type:ticket.subject_changed': TicketChange<'subject_changed'>;
  'zen:event-type:ticket.tags_changed': TicketEvent<
    'tags_changed',
    Meta & { tags_added: string[]; tags_removed: string[] }
  >;
  'zen:event-type:user.created': ZendeskWebhook<'user.created', ZendeskUserDetail, Record<string, never>>;
  'zen:event-type:user.deleted': ZendeskWebhook<'user.deleted', ZendeskUserDetail, Record<string, never>>;
}
