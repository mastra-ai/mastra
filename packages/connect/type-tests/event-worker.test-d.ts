import type { IMastraLogger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { expectTypeOf } from 'vitest';

import { ConnectEventWorker } from '../src/index.js';
import type { ConnectClient, GithubWebhookPayloads, LinearWebhookPayloads } from '../src/index.js';

// A function per event type: each handler gets that event type's payload.
new ConnectEventWorker({
  github: {
    'pull_request.opened': ({ event }) => {
      expectTypeOf(event.provider).toEqualTypeOf<'github'>();
      expectTypeOf(event.eventType).toEqualTypeOf<'pull_request.opened'>();
      expectTypeOf(event.payload).toEqualTypeOf<GithubWebhookPayloads['pull_request.opened']>();
      expectTypeOf(event.unverified).toEqualTypeOf<false>();
    },
    push: ({ event }) => {
      expectTypeOf(event.payload.ref).toEqualTypeOf<string>();
    },
  },
});

// One function for a whole typed provider narrows by event type.
new ConnectEventWorker({
  linear: async ({ event, mastra, logger, connect }) => {
    expectTypeOf(mastra).toEqualTypeOf<Mastra>();
    expectTypeOf(logger).toEqualTypeOf<IMastraLogger>();
    expectTypeOf(connect).toEqualTypeOf<ConnectClient>();
    expectTypeOf(event.provider).toEqualTypeOf<'linear'>();
    if (event.eventType === 'Issue.create') {
      expectTypeOf(event.payload).toEqualTypeOf<LinearWebhookPayloads['Issue.create']>();
    }
  },
});

// A provider Connect has no payload types for gets any event type, with an unknown payload.
new ConnectEventWorker({
  posthog: ({ event }) => {
    expectTypeOf(event.provider).toEqualTypeOf<'posthog'>();
    expectTypeOf(event.eventType).toEqualTypeOf<string>();
    expectTypeOf(event.payload).toEqualTypeOf<unknown>();
  },
  pylon: {
    'issue.new': ({ event }) => {
      expectTypeOf(event.payload).toEqualTypeOf<unknown>();
    },
  },
});

// With unverified events, the payload is only typed once the handler checks `unverified`.
new ConnectEventWorker(
  {
    linear: {
      'Issue.create': ({ event }) => {
        expectTypeOf(event.unverified).toEqualTypeOf<boolean>();
        // @ts-expect-error an unverified event's payload is unknown
        void event.payload.data;
        if (!event.unverified) {
          expectTypeOf(event.payload).toEqualTypeOf<LinearWebhookPayloads['Issue.create']>();
        }
      },
    },
  },
  { includeUnverified: true },
);

new ConnectEventWorker({
  linear: {
    // @ts-expect-error not a Linear event type
    'Issue.creat': () => {},
  },
});

new ConnectEventWorker({
  github: {
    // @ts-expect-error the handler gets a context object, and the payload has no `nope`
    'pull_request.opened': ({ event }) => void event.payload.nope,
  },
});

// The docs' usage example.
new ConnectEventWorker({
  github: {
    'pull_request.opened': async ({ event, mastra }) => {
      const agent = mastra.getAgent('reviewer');
      await agent.generate(`Review ${event.payload.pull_request.html_url}`);
    },
  },
  linear: {
    'Issue.create': async ({ event, mastra }) => {
      const run = await mastra.getWorkflow('triageIssue').createRun({
        runId: `linear:${event.sourceEventId ?? event.id}`,
        resourceId: event.resourceId,
      });
      if (run.workflowRunStatus === 'pending') await run.startAsync({ inputData: { issueId: event.payload.data.id } });
    },
  },
});
