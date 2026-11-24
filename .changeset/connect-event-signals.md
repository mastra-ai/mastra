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
});

const agent = new Agent({ id: 'ops', name: 'Ops', instructions, model, signals: [signals] });
```

Without `events`, every event is sent. Listed event types of a provider with typed payloads give `target` and `notification` a typed payload. Unverified events are dropped unless `includeUnverified` is set, and a redelivered webhook doesn't notify twice.
