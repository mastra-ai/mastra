---
'@mastra/connect': minor
---

Added `ConnectEventSignals`, a signal provider that sends provider webhook events from a project's Connect connections to an agent as notification signals. Choose which providers and event types reach the agent, and which thread each event goes to:

```ts
import { Agent } from '@mastra/core/agent';
import { ConnectEventSignals } from '@mastra/connect';

const signals = new ConnectEventSignals({
  events: { github: ['pull_request.opened'], linear: true },
  target: event => ({ threadId: `${event.provider}:${event.connectionId}`, resourceId: 'team-ops' }),
  notification: event =>
    event.provider === 'github' ? { summary: `PR opened: ${event.payload.pull_request.title}` } : undefined,
  // At most 5 events per connection wake the agent each minute.
  rateLimit: { limit: 5, windowMs: 60_000 },
});

const agent = new Agent({ id: 'ops', name: 'Ops', instructions, model, signals: [signals] });
```

Without `events`, every event is sent. A provider with typed payloads only sends the event types Connect has types for, so `target` and `notification` get a typed payload once they check `provider` and `eventType`. Unverified events are dropped unless `includeUnverified` is set, and a redelivered webhook doesn't notify twice.

`rateLimit` caps how many events of one connection can wake an idle agent in a window, so a burst of webhooks can't start a model run per event. Events past the limit are still stored on the thread, marked `rateLimited` in their metadata, and the agent sees them on its next run. Events whose target never wakes the agent (`ifIdle.behavior` of `persist` or `discard`) don't count.
