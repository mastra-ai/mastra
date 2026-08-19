---
'@mastra/core': minor
---

Messages sent to a busy agent are now marked as interjections by the session itself. Any user message submitted while a run is in flight — including the one `session.steer()` sends after interrupting a run — carries `delivery: 'while-active'`, so the agent reads it as context for the work in progress and a reloaded transcript can still tell a steer apart from a normal message. Clients no longer have to attach the attribute themselves.

```ts
// before: only callers that passed delivery options got the attribute
session.sendSignal({ content, ifActive: { attributes: { delivery: 'while-active' } } });

// now: the session stamps it from the run state it already tracks
session.sendSignal({ content });
session.steer({ content });
```

Delivery attributes supplied by the caller still win.
