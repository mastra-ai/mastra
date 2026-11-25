---
'@mastra/core': minor
---

Added `ChannelThreadLinkProcessor`, which posts a link to the conversation in your app right after an agent's first reply in a new Slack (or other channel) thread. Pass a `link` function that builds the URL from the run's thread id; the link is kept out of saved memory.

```ts
import { ChannelThreadLinkProcessor } from '@mastra/core/channels';

new Agent({
  // ...
  outputProcessors: [
    new ChannelThreadLinkProcessor({
      label: 'Open thread ↗',
      link: ({ threadId }) => threadId && `https://app.example.com/threads/${threadId}`,
    }),
  ],
});
```

`AgentChannels` now marks runs that create a thread; hosts that decide this themselves can call `markNewChannelThread(requestContext)`.

Added `channelReplyMode()`, an opt-in channel display preset: reply text and tool calls stay out of the thread, the typing status names the agent's current step, and the agent posts through a `reply_in_thread` tool that streams into the thread, with a reminder after five quiet minutes. Pass `link` to append a web UI link to the first reply of a new thread.

```ts
const reply = channelReplyMode({ link: { link: ({ threadId }) => `${appUrl}/threads/${threadId}` } });
// adapter options: reply.adapterOptions; processors: reply.processors; tools: reply.tools(requestContext)
```

`channelReplyMode()` also adds `ChannelReplyGuidanceProcessor`, which tells the agent how to speak in the channel: open long jobs with one line, finish with the outcome, write for people, and link references. Hosts add their own lines with `guidance.instructions`.
