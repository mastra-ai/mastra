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
