import { expectTypeOf } from 'vitest';

import { isConnectEvent } from '../src/index.js';
import type {
  ConnectEvent,
  ConnectEvents,
  ConnectEventOf,
  ConnectEventType,
  GithubWebhookPayloads,
  JiraWebhookPayloads,
  UntypedConnectEvent,
  WorkosWebhookPayloads,
} from '../src/index.js';

declare const event: ConnectEvent;

// `ConnectEvents` yields `ConnectEvent`, so every consumer can narrow it.
declare const events: ConnectEvents;
expectTypeOf(events).toExtend<AsyncIterable<ConnectEvent>>();

// Without narrowing, the payload is unknown: an event may be any integration's,
// unverified, or not JSON.
expectTypeOf(event.payload).toBeUnknown();

// One event type narrows the payload to its documented shape.
if (isConnectEvent(event, 'github', 'pull_request.opened')) {
  expectTypeOf(event.integrationId).toEqualTypeOf<'github'>();
  expectTypeOf(event.unverified).toEqualTypeOf<false>();
  expectTypeOf(event.payload.action).toEqualTypeOf<'opened'>();
  expectTypeOf(event.payload.pull_request.number).toBeNumber();
  expectTypeOf(event.payload).toEqualTypeOf<GithubWebhookPayloads['pull_request.opened']>();
  // Used in the reference docs' example.
  expectTypeOf(event.payload.repository.full_name).toBeString();
}

if (isConnectEvent(event, 'linear', ['Issue.create', 'Issue.update'])) {
  // Used in the reference docs' example.
  expectTypeOf(event.payload.data.id).toBeString();
}

// Several event types narrow to their union, discriminated by `eventType`.
if (isConnectEvent(event, 'linear', ['Issue.create', 'Comment.create'])) {
  if (event.eventType === 'Issue.create') {
    expectTypeOf(event.payload.type).toEqualTypeOf<'Issue'>();
    expectTypeOf(event.payload.action).toEqualTypeOf<'create'>();
    expectTypeOf(event.payload.data.title).toBeString();
  } else {
    expectTypeOf(event.eventType).toEqualTypeOf<'Comment.create'>();
    expectTypeOf(event.payload.data.body).toBeString();
  }
}

if (isConnectEvent(event, 'gitlab', 'Merge Request Hook')) {
  expectTypeOf(event.payload.object_kind).toEqualTypeOf<'merge_request'>();
  expectTypeOf(event.payload.object_attributes.iid).toBeNumber();
}

if (isConnectEvent(event, 'jira', 'jira:issue_updated')) {
  expectTypeOf(event.payload.webhookEvent).toEqualTypeOf<'jira:issue_updated'>();
  expectTypeOf(event.payload).toEqualTypeOf<JiraWebhookPayloads['jira:issue_updated']>();
}

if (isConnectEvent(event, 'incident-io', 'public_incident.incident_created_v2')) {
  expectTypeOf(event.payload.event_type).toEqualTypeOf<'public_incident.incident_created_v2'>();
}

if (isConnectEvent(event, 'openai', 'response.completed')) {
  expectTypeOf(event.payload.type).toEqualTypeOf<'response.completed'>();
  expectTypeOf(event.payload.data.id).toBeString();
}

if (isConnectEvent(event, 'resend', 'email.sent')) {
  expectTypeOf(event.payload.type).toEqualTypeOf<'email.sent'>();
  expectTypeOf(event.payload.created_at).toBeString();
}

if (isConnectEvent(event, 'clerk', 'user.created')) {
  expectTypeOf(event.payload.type).toEqualTypeOf<'user.created'>();
  expectTypeOf(event.payload.data.id).toBeString();
}

if (isConnectEvent(event, 'workos', 'dsync.user.created')) {
  expectTypeOf(event.payload.event).toEqualTypeOf<'dsync.user.created'>();
  expectTypeOf(event.payload.data.email).toEqualTypeOf<WorkosWebhookPayloads['dsync.user.created']['data']['email']>();
}

if (isConnectEvent(event, 'elevenlabs', 'post_call_transcription')) {
  expectTypeOf(event.payload.data.conversation_id).toBeString();
}

if (isConnectEvent(event, 'telegram', 'message')) {
  expectTypeOf(event.payload.update_id).toBeNumber();
  expectTypeOf(event.payload.message.chat.id).toBeNumber();
}

if (isConnectEvent(event, 'slack', 'message')) {
  expectTypeOf(event.payload.type).toEqualTypeOf<'event_callback'>();
  expectTypeOf(event.payload.event.channel).toBeString();
}

if (isConnectEvent(event, 'sendgrid', 'bounce')) {
  expectTypeOf(event.payload.event).toEqualTypeOf<'bounce'>();
  expectTypeOf(event.payload.email).toBeString();
}

if (isConnectEvent(event, 'hubspot', 'deal.propertyChange')) {
  expectTypeOf(event.payload.subscriptionType).toEqualTypeOf<'deal.propertyChange'>();
  expectTypeOf(event.payload.propertyName).toBeString();
}

if (isConnectEvent(event, 'outlook', ['message.created', 'lifecycle.missed'])) {
  if (event.eventType === 'message.created') {
    expectTypeOf(event.payload.changeType).toEqualTypeOf<'created'>();
  } else {
    expectTypeOf(event.payload.lifecycleEvent).toEqualTypeOf<'missed'>();
  }
}

if (isConnectEvent(event, 'notion', 'page.properties_updated')) {
  expectTypeOf(event.payload.data.updated_properties).toEqualTypeOf<string[]>();
}

if (isConnectEvent(event, 'zendesk', 'zen:event-type:ticket.status_changed')) {
  expectTypeOf(event.payload.detail.status).toBeString();
  expectTypeOf(event.payload.event.current).toEqualTypeOf<string | null>();
}

if (isConnectEvent(event, 'fireflies', 'meeting.transcribed')) {
  expectTypeOf(event.payload.meeting_id).toBeString();
}

if (isConnectEvent(event, 'supabase', ['INSERT', 'DELETE'])) {
  if (event.eventType === 'INSERT') {
    expectTypeOf(event.payload.old_record).toBeNull();
  } else {
    expectTypeOf(event.payload.record).toBeNull();
  }
}

// Unknown integrations and event types are compile errors.
// @ts-expect-error not a typed integration
isConnectEvent(event, 'not-an-integration', 'x');
// @ts-expect-error not a GitHub event type
isConnectEvent(event, 'github', 'Issue.create');
// @ts-expect-error event types belong to the integration they're checked with
isConnectEvent(event, 'linear', ['Issue.create', 'pull_request.opened']);

// Every typed GitHub event, discriminated by `eventType`.
declare const github: ConnectEventOf<'github'>;
if (github.eventType === 'push') {
  expectTypeOf(github.payload.ref).toBeString();
}
expectTypeOf<'push'>().toExtend<ConnectEventType<'github'>>();

// The guard accepts any event, including one received outside `ConnectEvents`.
declare const untyped: UntypedConnectEvent;
if (isConnectEvent(untyped, 'gitlab', 'Push Hook')) {
  expectTypeOf(untyped.payload.commits).toBeArray();
}

// A typed event is still an untyped event, so handlers taking the raw shape
// accept narrowed events.
expectTypeOf<ConnectEventOf<'linear'>>().toExtend<UntypedConnectEvent>();
