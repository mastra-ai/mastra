---
'@mastra/slack': minor
---

Added `createSlackTools()`, which returns Slack-only agent tools: `findChannel`, `findUser`, `searchMessages` and `downloadSlackAttachment`. They take the same options as `createChannelTools()` from `@mastra/core/channels`. `searchMessages` and `downloadSlackAttachment` only read channels those options allow. `findChannel` and `findUser` look up the whole workspace.

```ts
import { createChannelTools } from '@mastra/core/channels';
import { createSlackTools } from '@mastra/slack';

const limits = { channels: 'all', access: 'read' } as const;
const agent = new Agent({
  tools: { ...(await createChannelTools(limits)), ...createSlackTools(limits) },
});
```
