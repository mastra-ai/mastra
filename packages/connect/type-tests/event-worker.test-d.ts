import { createStep, createWorkflow } from '@mastra/core/workflows';
import { expectTypeOf } from 'vitest';
import { z } from 'zod';

import { ConnectEventWorker, onConnectEvent } from '../src/index.js';
import type { ConnectEvent, GithubWebhookPayloads } from '../src/index.js';

const record = createStep({
  id: 'record',
  inputSchema: z.any(),
  outputSchema: z.object({}),
  execute: async () => ({}),
});
const reviewPullRequest = createWorkflow({
  id: 'review-pull-request',
  inputSchema: z.object({ repo: z.string(), number: z.number() }),
  outputSchema: z.object({}),
})
  .then(record)
  .commit();

// Listed event types of a typed provider have typed payloads, and the input
// must match the workflow's input schema.
onConnectEvent({
  events: { github: ['pull_request.opened', 'pull_request.reopened'] },
  workflow: reviewPullRequest,
  inputData: event => {
    expectTypeOf(event.eventType).toEqualTypeOf<'pull_request.opened' | 'pull_request.reopened'>();
    if (event.eventType === 'pull_request.opened') {
      expectTypeOf(event.payload).toEqualTypeOf<GithubWebhookPayloads['pull_request.opened']>();
    }
    return { repo: event.payload.repository.full_name, number: event.payload.number };
  },
});

// Returning undefined skips the event.
onConnectEvent({
  events: { github: ['pull_request.opened'] },
  workflow: reviewPullRequest,
  inputData: event =>
    event.payload.pull_request.base.ref === 'main'
      ? { repo: event.payload.repository.full_name, number: event.payload.number }
      : undefined,
});

onConnectEvent({
  events: { github: ['pull_request.opened'] },
  workflow: reviewPullRequest,
  // @ts-expect-error the input doesn't match the workflow's input schema
  inputData: event => ({ repo: event.payload.repository.full_name }),
});

onConnectEvent({
  // @ts-expect-error not a GitHub event type
  events: { github: ['pull_request.opend'] },
  workflow: reviewPullRequest,
  inputData: () => undefined,
});

// Without a filter, inputData gets any verified event.
onConnectEvent({
  workflow: reviewPullRequest,
  inputData: event => {
    expectTypeOf(event).toExtend<ConnectEvent>();
    expectTypeOf(event.unverified).toEqualTypeOf<false>();
    expectTypeOf(event.payload).toBeUnknown();
    return undefined;
  },
});

// With includeUnverified, check `unverified` before trusting the payload.
onConnectEvent({
  events: { github: ['pull_request.opened'] },
  includeUnverified: true,
  workflow: reviewPullRequest,
  inputData: event => {
    expectTypeOf(event.unverified).toEqualTypeOf<boolean>();
    expectTypeOf(event.payload).toBeUnknown();
    if (!event.unverified) {
      return { repo: event.payload.repository.full_name, number: event.payload.number };
    }
    return undefined;
  },
});

new ConnectEventWorker({
  triggers: [
    onConnectEvent({
      events: { linear: ['Issue.create'] },
      workflow: reviewPullRequest,
      inputData: () => undefined,
    }),
  ],
});
