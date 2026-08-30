---
'@mastra/factory': minor
---

Slack threads and work-item feeds are now one conversation seen from two windows.

**Slack → feed** — a message starting with `aside`, the human chatter the agent deliberately never answers, now lands as a comment on the card the thread created. A sender who has linked their Slack account is attributed to their Mastra user; an unlinked one is stored under their Slack identity and display name, so the thread stays complete either way.

**Feed → Slack** — a comment written in the Factory feed is posted into the bound Slack thread, attributed as `**Name**: body` (the app cannot post as the commenter).

Both directions are create-only: comment edits and deletions do not propagate, and Slack edits and deletions never reach the feed because the adapter does not deliver those events to handlers. Mirroring stays best-effort — a failed post is logged, not retried.

A channel integration opts in by implementing the new `feedPublisher` slot alongside `channels`:

```ts
class SlackIntegration implements FactoryIntegration {
  channels(ctx: IntegrationContext) {
    return createSlackChannelsConfig({ ...deps, feed: ctx.feed });
  }

  feedPublisher(ctx: IntegrationContext) {
    return new SlackFeedPublisher({ controller: ctx.controller });
  }
}
```
