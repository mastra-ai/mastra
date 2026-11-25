import { expectTypeOf } from 'vitest';

import { ConnectEvents } from '../src/index.js';
import type {
  ConnectEvent,
  ConnectEventOf,
  ConnectEventPayloads,
  ConnectEventType,
  FilteredConnectEvent,
  GithubWebhookPayloads,
  JiraWebhookPayloads,
  UntypedConnectEvent,
  WorkosWebhookPayloads,
} from '../src/index.js';

// Without a filter, providers without typed payloads come through too, so the
// payload can't be narrowed.
for await (const event of new ConnectEvents()) {
  expectTypeOf(event).toExtend<ConnectEvent>();
  expectTypeOf(event.unverified).toEqualTypeOf<false>();
  expectTypeOf(event.payload).toBeUnknown();
}

// Listing event types types the payload.
for await (const event of new ConnectEvents({ events: { github: ['pull_request.opened'] } })) {
  expectTypeOf(event).toEqualTypeOf<ConnectEventOf<'github', 'pull_request.opened'>>();
  expectTypeOf(event.payload.pull_request.title).toBeString();
}

// `true` for a typed provider delivers only typed events, so `eventType` narrows.
for await (const event of new ConnectEvents({ events: { github: true, linear: ['Issue.create'], posthog: true } })) {
  if (event.provider === 'github') {
    expectTypeOf(event).toEqualTypeOf<ConnectEventOf<'github'>>();
    if (event.eventType === 'issues.opened') {
      expectTypeOf(event.payload).toEqualTypeOf<GithubWebhookPayloads['issues.opened']>();
    }
  } else if (event.provider === 'linear') {
    expectTypeOf(event.payload.data.title).toBeString();
  } else {
    // A provider without typed payloads keeps an unknown payload.
    expectTypeOf(event.provider).toEqualTypeOf<'posthog'>();
    expectTypeOf(event.payload).toBeUnknown();
  }
}

// With unverified events, check `unverified` before the payload is typed.
for await (const event of new ConnectEvents({ events: { jira: true }, includeUnverified: true })) {
  expectTypeOf(event.payload).toBeUnknown();
  if (!event.unverified && event.eventType === 'jira:issue_updated') {
    expectTypeOf(event.payload).toEqualTypeOf<JiraWebhookPayloads['jira:issue_updated']>();
  }
}

// @ts-expect-error not an event type of github
new ConnectEvents({ events: { github: ['pull_request.opend'] } });

// Every typed provider's events narrow by `provider` and `eventType`.
declare const event: FilteredConnectEvent<{ readonly [P in keyof ConnectEventPayloads]: true }>;

// One event type narrows the payload to its documented shape.
if (event.provider === 'github' && event.eventType === 'pull_request.opened') {
  expectTypeOf(event.provider).toEqualTypeOf<'github'>();
  expectTypeOf(event.unverified).toEqualTypeOf<false>();
  expectTypeOf(event.payload.action).toEqualTypeOf<'opened'>();
  expectTypeOf(event.payload.pull_request.number).toBeNumber();
  expectTypeOf(event.payload).toEqualTypeOf<GithubWebhookPayloads['pull_request.opened']>();
  // Used in the reference docs' example.
  expectTypeOf(event.payload.repository.full_name).toBeString();
}

if (event.provider === 'linear' && (event.eventType === 'Issue.create' || event.eventType === 'Issue.update')) {
  // Used in the reference docs' example.
  expectTypeOf(event.payload.data.id).toBeString();
}

// Several event types narrow to their union, discriminated by `eventType`.
if (event.provider === 'linear' && (event.eventType === 'Issue.create' || event.eventType === 'Comment.create')) {
  if (event.eventType === 'Issue.create') {
    expectTypeOf(event.payload.type).toEqualTypeOf<'Issue'>();
    expectTypeOf(event.payload.action).toEqualTypeOf<'create'>();
    expectTypeOf(event.payload.data.title).toBeString();
  } else {
    expectTypeOf(event.eventType).toEqualTypeOf<'Comment.create'>();
    expectTypeOf(event.payload.data.body).toBeString();
  }
}

if (event.provider === 'gitlab' && event.eventType === 'Merge Request Hook') {
  expectTypeOf(event.payload.object_kind).toEqualTypeOf<'merge_request'>();
  expectTypeOf(event.payload.object_attributes.iid).toBeNumber();
}

if (event.provider === 'jira' && event.eventType === 'jira:issue_updated') {
  expectTypeOf(event.payload.webhookEvent).toEqualTypeOf<'jira:issue_updated'>();
  expectTypeOf(event.payload).toEqualTypeOf<JiraWebhookPayloads['jira:issue_updated']>();
}

if (event.provider === 'incident-io' && event.eventType === 'public_incident.incident_created_v2') {
  expectTypeOf(event.payload.event_type).toEqualTypeOf<'public_incident.incident_created_v2'>();
}

if (event.provider === 'openai' && event.eventType === 'response.completed') {
  expectTypeOf(event.payload.type).toEqualTypeOf<'response.completed'>();
  expectTypeOf(event.payload.data.id).toBeString();
}

if (event.provider === 'resend' && event.eventType === 'email.sent') {
  expectTypeOf(event.payload.type).toEqualTypeOf<'email.sent'>();
  expectTypeOf(event.payload.created_at).toBeString();
}

if (event.provider === 'clerk' && event.eventType === 'user.created') {
  expectTypeOf(event.payload.type).toEqualTypeOf<'user.created'>();
  expectTypeOf(event.payload.data.id).toBeString();
}

if (event.provider === 'workos' && event.eventType === 'dsync.user.created') {
  expectTypeOf(event.payload.event).toEqualTypeOf<'dsync.user.created'>();
  expectTypeOf(event.payload.data.email).toEqualTypeOf<WorkosWebhookPayloads['dsync.user.created']['data']['email']>();
}

if (event.provider === 'elevenlabs' && event.eventType === 'post_call_transcription') {
  expectTypeOf(event.payload.data.conversation_id).toBeString();
}

if (event.provider === 'telegram' && event.eventType === 'message') {
  expectTypeOf(event.payload.update_id).toBeNumber();
  expectTypeOf(event.payload.message.chat.id).toBeNumber();
}

if (event.provider === 'slack' && event.eventType === 'message') {
  expectTypeOf(event.payload.type).toEqualTypeOf<'event_callback'>();
  expectTypeOf(event.payload.event.channel).toBeString();
}

if (event.provider === 'sendgrid' && event.eventType === 'bounce') {
  expectTypeOf(event.payload.event).toEqualTypeOf<'bounce'>();
  expectTypeOf(event.payload.email).toBeString();
}

if (event.provider === 'hubspot' && event.eventType === 'deal.propertyChange') {
  expectTypeOf(event.payload.subscriptionType).toEqualTypeOf<'deal.propertyChange'>();
  expectTypeOf(event.payload.propertyName).toBeString();
}

if (event.provider === 'outlook' && (event.eventType === 'message.created' || event.eventType === 'lifecycle.missed')) {
  if (event.eventType === 'message.created') {
    expectTypeOf(event.payload.changeType).toEqualTypeOf<'created'>();
  } else {
    expectTypeOf(event.payload.lifecycleEvent).toEqualTypeOf<'missed'>();
  }
}

if (event.provider === 'notion' && event.eventType === 'page.properties_updated') {
  expectTypeOf(event.payload.data.updated_properties).toEqualTypeOf<string[]>();
}

if (event.provider === 'zendesk' && event.eventType === 'zen:event-type:ticket.status_changed') {
  expectTypeOf(event.payload.detail.status).toBeString();
  expectTypeOf(event.payload.event.current).toEqualTypeOf<string | null>();
}

if (event.provider === 'fireflies' && event.eventType === 'meeting.transcribed') {
  expectTypeOf(event.payload.meeting_id).toBeString();
}

if (event.provider === 'supabase' && (event.eventType === 'INSERT' || event.eventType === 'DELETE')) {
  if (event.eventType === 'INSERT') {
    expectTypeOf(event.payload.old_record).toBeNull();
  } else {
    expectTypeOf(event.payload.record).toBeNull();
  }
}

// Every typed GitHub event, discriminated by `eventType`.
declare const github: ConnectEventOf<'github'>;
if (github.eventType === 'push') {
  expectTypeOf(github.payload.ref).toBeString();
}
expectTypeOf<'push'>().toExtend<ConnectEventType<'github'>>();

// A typed event is still an untyped event, so handlers taking the raw shape
// accept narrowed events.
expectTypeOf<ConnectEventOf<'linear'>>().toExtend<UntypedConnectEvent>();

// A union of providers gives each provider's events.
declare const repoEvent: ConnectEventOf<'github' | 'gitlab'>;
expectTypeOf(repoEvent.provider).toEqualTypeOf<'github' | 'gitlab'>();
if (repoEvent.provider === 'gitlab' && repoEvent.eventType === 'Push Hook') {
  expectTypeOf(repoEvent.payload.ref).toBeString();
}
// @ts-expect-error -- not a GitHub event type
type Misspelled = ConnectEventOf<'github', 'pull_request.opend'>;
