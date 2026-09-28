---
'@mastra/connect': patch
---

Added Microsoft Teams to channels(). Projects with an active microsoft-teams platform connection now resolve a TeamsProvider automatically — no bot credentials in your code. The provider runs in delegated mode: connecting an agent provisions a dedicated Teams bot for it through the platform connection.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { channels } from '@mastra/connect';

const mastra = new Mastra({
  agents: { myAgent },
  channels: await channels({ projectId: process.env.MASTRA_PROJECT_ID }),
});

// With a microsoft-teams connection active, the Teams channel resolves
// automatically and agents can be connected from Studio or via the API.
```
