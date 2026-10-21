---
'@mastra/factory': minor
---

Added a `reply_in_thread` tool so a session's agent chooses what it posts to Slack. Reply text no longer posts to the thread on its own. The agent posts a short note when it starts a longer job, asks questions when it needs an answer, and posts the outcome when it finishes. To stay quiet, it just doesn't post.

To post the agent's full reply text again:

```ts
new SlackIntegration({ signingSecret, adapterOptions: { textDisplay: 'show' } });
```
