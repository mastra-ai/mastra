---
'@mastra/factory': minor
---

Added Slack tools for Factory sessions started from Slack. A session can read channels and threads, post messages, search recent messages, and find channels and people by name. The tools act as the Slack app, and posting needs no approval, so they also work on runs nobody is watching.

**Access**

By default a session can read and post only in its own channel, and can't send direct messages. Use the new `tools` option to grant more:

```ts
new SlackIntegration({
  signingSecret,
  tools: {
    channels: 'all', // or 'selected' with channelIds: ['C0123456']
    channelAccess: 'post', // or 'read' to post only in the session's own channel
    directMessages: 'anyone',
  },
});
```

Even with `channels: 'all'`, a session can only read channels the Slack app has been added to.
