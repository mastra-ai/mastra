---
'@mastra/connect': minor
---

Added `ConnectEventWorker`, a Mastra worker that starts workflows from provider webhook events on a project's Connect connections. Each `onConnectEvent` trigger picks the providers and event types that start a workflow, and builds its input from the event:

```ts
import { Mastra } from '@mastra/core/mastra';
import { ConnectEventWorker, onConnectEvent } from '@mastra/connect';

const connectEvents = new ConnectEventWorker({
  triggers: [
    onConnectEvent({
      events: { github: ['pull_request.opened'] },
      workflow: reviewPullRequest,
      inputData: event => ({ repo: event.payload.repository.full_name, number: event.payload.number }),
    }),
  ],
});

export const mastra = new Mastra({ workflows: { reviewPullRequest }, workers: [connectEvents] });
```

Listed event types of a provider with typed payloads give `inputData` a typed payload, and its return type is checked against the workflow's input. Return `undefined` to skip an event. Each event starts a workflow once, even when the webhook is redelivered, and the run gets the event's `resourceId` when the connection belongs to an end user. Unverified events are skipped unless `includeUnverified` is set.
