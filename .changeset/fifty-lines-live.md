---
'@mastra/core': minor
---

The session now records whether the user was watching the agent work when they hit send, and every client gets it for free. A message typed into a live run — including the one `session.steer()` sends after interrupting — carries `delivery: 'while-active'`; a message that opens a new turn carries `delivery: 'message'`. The agent reads the first as context for the work in progress, and a reloaded transcript can still tell a steer apart from a normal message.

Before, the attribute was resolved from the run state at dispatch time, which reads idle for a steer (a steer aborts its own run before sending), so each client had to describe both delivery routes itself.

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
