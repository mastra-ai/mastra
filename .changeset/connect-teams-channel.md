---
'@mastra/connect': minor
---

Added Microsoft Teams to `channels()` and re-keyed the Slack channel from `slack` to `slack-channels`.

**Microsoft Teams**: projects with an active `microsoft-teams` platform connection now resolve a `TeamsProvider` automatically — no bot credentials in your code. Connecting an agent provisions a dedicated Teams bot for it through the platform connection.

**Breaking: Slack channel integration id renamed**. Use the `slack-channels` connection to hook the Slack channel up to agents; the existing `slack` connection continues to back the generated Slack **tools**. Two separate connections, one purpose each.

If you pass per-integration overrides to `channels()`, migrate the key:

```diff
 channels: await channels({
   projectId: process.env.MASTRA_PROJECT_ID,
   integrations: {
-    slack: { providerOptions: { defaultChannel: 'C123' } },
+    'slack-channels': { providerOptions: { defaultChannel: 'C123' } },
   },
 }),
```

```typescript
import { Mastra } from '@mastra/core/mastra';
import { channels } from '@mastra/connect';

const mastra = new Mastra({
  agents: { myAgent },
  channels: await channels({ projectId: process.env.MASTRA_PROJECT_ID }),
});

// With `microsoft-teams` and `slack-channels` connections active, both
// channels resolve automatically and agents can be connected from Studio
// or via the API.
```
