---
'@mastra/factory': minor
---

Added a `reply_in_thread` tool so a session's agent chooses what it posts to Slack, instead of every bit of reply text landing in the thread. The agent posts a short note when it starts a longer job, asks when it needs an answer, and posts the outcome when it finishes. To stay quiet, it doesn't post.

- Replies stream into the thread as the agent writes them, with "is typing..." while they start.
- After five minutes without posting, the agent gets one reminder to post a short status if it would help.
- When you prompt a Slack-linked session from the web UI, or it wakes up on its own, the agent posts only the outcome to the thread. It does that when people there asked for the work or are waiting on it.

To post the agent's full reply text again:

```ts
new SlackIntegration({ signingSecret, adapterOptions: { textDisplay: 'show' } });
```
