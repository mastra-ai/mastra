---
'@mastra/core': patch
---

Subscribing to an agent-controller session now delivers what the session already holds ahead of live events. While a run is in flight, its messages come first: the ones already ended as `message_end` (the prompt that opened the run, a steer, an assistant message a later step rotated away), then the one still streaming as `message_update`. History holds none of them until the run ends, so a client attaching mid-step, such as a browser opening the thread or reconnecting its stream, drew the step under no prompt or waited for the next event. The current display state follows as `display_state_changed`, on every subscribe, so a running tool, a parked approval or `ask_user` prompt and a running subagent land too. Nothing of the messages is replayed once the run ended: history carries them then.

```ts
session.emit({ type: 'agent_start' });
session.emit({ type: 'message_end', message: prompt });
session.emit({ type: 'message_update', message });
session.emit({ type: 'tool_start', toolCallId: 'call-1', toolName: 'checkout', args: {} });

session.subscribe(event => {
  // first calls: message_end { prompt }, message_update { message }, display_state_changed { activeTools: call-1 }
});
```
