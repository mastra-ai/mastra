---
'@mastra/core': minor
---

Added two channel adapter options, `replyMode` and `threadLink`.

`replyMode: 'tool'` has the agent post only through a `reply_in_thread` tool, which Mastra installs. Reply text and tool calls stay out of the thread, the typing status names the agent's current step, the reply streams into the thread as it is written when the adapter sets `streaming: true`, the prompt tells the agent to open long work with one line and finish with the outcome, and the agent is reminded to post after five quiet minutes. Pass `{ instructions, reminderAfterMs }` instead of `'tool'` to add your own prompt lines or change the reminder. Reply mode has only been tested with Slack.

`threadLink` ends the first reply in a new thread with a link to your web UI. The link is kept out of saved memory.

```ts
channels: {
  adapters: {
    slack: {
      adapter: createSlackAdapter(),
      replyMode: 'tool',
      threadLink: ({ threadId }) => `https://app.example.com/threads/${threadId}`,
    },
  },
},
```

`ChannelThreadLinkProcessor` is also exported for hosts that add processors themselves. `AgentChannels` marks runs that create a thread; hosts that decide this themselves can call `markNewChannelThread(requestContext)`.
