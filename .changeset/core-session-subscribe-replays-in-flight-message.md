---
'@mastra/core': patch
---

Subscribing to an agent-controller session while a run is in flight now delivers the messages of that run ahead of live events: the ones already ended as `message_end` (the prompt that opened the run, a steer, an assistant message a later step rotated away), then the one still streaming as `message_update`. History holds none of them until the run ends, so a client attaching mid-step, such as a browser opening the thread or reconnecting its stream, drew the step under no prompt or waited for the next event. Nothing is replayed once the run ended: history carries the messages then.

```ts
session.emit({ type: 'agent_start' });
session.emit({ type: 'message_end', message: prompt });
session.emit({ type: 'message_update', message });

session.subscribe(event => {
  // first calls: { type: 'message_end', message: prompt }, { type: 'message_update', message }
});
```
