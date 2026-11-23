---
'@mastra/slack': minor
---

Added `createSlackTools()`, which returns Slack-only agent tools: `findChannel`, `findUser`, `searchMessages` and `downloadSlackAttachment`. They take the same options as `createChannelTools()` from `@mastra/core/channels` and keep to the same channels.

```ts
import { createChannelTools } from '@mastra/core/channels';
import { createSlackTools } from '@mastra/slack';

const limits = { channels: 'all', access: 'read' } as const;
const agent = new Agent({
  tools: { ...(await createChannelTools(limits)), ...createSlackTools(limits) },
});
```
