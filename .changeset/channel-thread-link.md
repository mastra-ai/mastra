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
