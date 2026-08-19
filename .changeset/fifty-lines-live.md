---
'@mastra/core': minor
---

The session now marks a message you send while the agent is working, and every client gets it for free. Any user message submitted with a run in flight — including the one `session.steer()` sends after interrupting a run — carries `delivery: 'while-active'`, so the agent reads it as context for the work in progress and a reloaded transcript can still tell a steer apart from a normal message. A message that opens a new turn is unmarked, as before.

The attribute used to be resolved from the run state at dispatch time, which reads idle for a steer (a steer aborts its own run before sending), so each client had to describe both delivery routes itself.

```ts
// before
session.sendSignal({
  content,
  ifActive: { attributes: { delivery: 'while-active' } },
  ifIdle: { attributes: { delivery: 'message' } },
});

// now
session.sendSignal({ content });
```

A `delivery` the caller sets on the signal still wins.
