---
'@mastra/factory': minor
---

Added a `reply_in_thread` tool so a session's agent chooses what it posts to Slack. Reply text no longer posts to the thread on its own; the agent sends a short note when it starts a longer job, a question it needs answered, and the outcome, and can stay silent on purpose. Sessions can also react to messages with `add_reaction`. To post the agent's full reply text again:

```ts
new SlackIntegration({ signingSecret, adapterOptions: { textDisplay: 'show' } });
```
