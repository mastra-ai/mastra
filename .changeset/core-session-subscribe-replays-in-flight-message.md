---
'@mastra/core': patch
---

Subscribing to an agent-controller session while a run is in flight now delivers the assistant message streamed so far as a `message_update` first, ahead of live events. A client attaching mid-step, such as a browser opening the thread or reconnecting its stream, draws the step as it stands instead of waiting for the next event. Nothing is replayed once the run ended: history carries the message then.

```ts
session.emit({ type: 'agent_start' });
session.emit({ type: 'message_update', message });

session.subscribe(event => {
  // first call: { type: 'message_update', message }
});
```
