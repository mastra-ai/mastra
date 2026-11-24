import { expectTypeOf } from 'vitest';

import { ConnectEventSignals } from '../src/index.js';
import type { ConnectEvent, GithubWebhookPayloads, LinearWebhookPayloads } from '../src/index.js';

const target = { threadId: 'ops', resourceId: 'team-ops' };

// Without a filter, callbacks get any verified event.
new ConnectEventSignals({
  target: event => {
    expectTypeOf(event).toExtend<ConnectEvent>();
    expectTypeOf(event.unverified).toEqualTypeOf<false>();
    expectTypeOf(event.payload).toBeUnknown();
    return target;
  },
});

// Listed event types of a typed provider have typed payloads.
new ConnectEventSignals({
  events: {
    github: ['pull_request.opened', 'pull_request.closed'],
    linear: true,
    posthog: ['$pageview'],
  },
  target,
  notification: event => {
    expectTypeOf(event.provider).toEqualTypeOf<'github' | 'linear' | 'posthog'>();
    if (event.provider === 'github') {
      expectTypeOf(event.eventType).toEqualTypeOf<'pull_request.opened' | 'pull_request.closed'>();
      if (event.eventType === 'pull_request.opened') {
        expectTypeOf(event.payload).toEqualTypeOf<GithubWebhookPayloads['pull_request.opened']>();
      }
      return { summary: `PR ${event.payload.action}: ${event.payload.pull_request.title}` };
    }
    if (event.provider === 'linear') {
      // Every Linear event includes types without typed payloads, so narrow
      // with `isConnectEvent` or check `payloadParseError` and the event type.
      expectTypeOf(event.payload).toBeUnknown();
      return undefined;
    }
    // A provider without typed payloads keeps its listed event types.
    expectTypeOf(event.eventType).toEqualTypeOf<'$pageview'>();
    expectTypeOf(event.payload).toBeUnknown();
    return undefined;
  },
});

// With unverified events included, check `unverified` before trusting the payload.
new ConnectEventSignals({
  events: { linear: ['Issue.create'] },
  includeUnverified: true,
  target,
  notification: event => {
    expectTypeOf(event.payload).toBeUnknown();
    if (!event.unverified) {
      expectTypeOf(event.payload).toEqualTypeOf<LinearWebhookPayloads['Issue.create']>();
    }
    return undefined;
  },
});

new ConnectEventSignals({
  // @ts-expect-error not an event type of github
  events: { github: ['pull_request.opend'] },
  target,
});

// @ts-expect-error a target is required
new ConnectEventSignals({ events: { linear: true } });
