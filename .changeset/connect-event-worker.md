---
'@mastra/connect': minor
---

Added `ConnectEventWorker`, a Mastra worker that handles provider webhook events on a project's Connect connections. Pass it handlers keyed by provider: a function for all of a provider's events, or an object with a function per event type. Each handler gets the event, the Mastra instance, its logger and a `ConnectClient` for the project:

```ts
import { Mastra } from '@mastra/core/mastra';
import { ConnectEventWorker } from '@mastra/connect';

const connectEvents = new ConnectEventWorker({
  github: {
    'pull_request.opened': async ({ event, mastra }) => {
      // A run id from the delivery id, so a redelivered webhook doesn't start a second run.
      const run = await mastra.getWorkflow('reviewPullRequest').createRun({
        runId: `github:${event.sourceEventId ?? event.id}`,
        resourceId: event.resourceId,
      });
      if (run.workflowRunStatus === 'pending') {
        await run.startAsync({
          inputData: { repo: event.payload.repository.full_name, number: event.payload.number },
        });
      }
    },
  },
  linear: async ({ event, logger }) => {
    logger.info('Linear event', { eventType: event.eventType });
  },
});

export const mastra = new Mastra({ workflows: { reviewPullRequest }, workers: [connectEvents] });
```

The worker only receives the providers and event types it has handlers for. Handlers for event types Connect has types for get typed payloads, and an object of handlers only accepts that provider's event types. When an event's connection belongs to an end user, `connect` is scoped to the event's `resourceId`. Events from different connections are handled concurrently, and one connection's events one at a time, in order. Unverified events are skipped unless `includeUnverified` is set. A failing handler is logged and the worker moves on. Delivery is at least once: the cursor only moves past an event once it and every earlier event have been handled, so handlers should tolerate seeing an event twice.
