---
'@mastra/core': minor
---

Added `createChannelTools()` to `@mastra/core/channels`. It gives any agent with channels tools that read and post messages on its chat platforms: `fetchMessages`, `fetchChannelMessages`, `fetchThread`, `listThreads`, `getThreadParticipants`, `getChannelInfo`, `postMessage` and `postChannelMessage`, plus `sendDirectMessage` when you allow it. Each call uses the channel thread of the run that makes it. By default the tools stay in that conversation's own channel. Nothing is added automatically, so spread the tools into `tools`:

```ts
import { createChannelTools } from '@mastra/core/channels';

const agent = new Agent({
  tools: { ...(await createChannelTools({ channels: 'selected', channelIds: ['slack:C0123ABC'], access: 'read' })) },
  channels: { adapters: { slack: createSlackAdapter() } },
});
```

Other people's direct messages with the bot can never be read. With `access: 'read'`, the tools post only in the conversation's own channel. The tools need zod 4.2 or newer.
