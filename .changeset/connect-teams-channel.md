---
'@mastra/connect': minor
---

Added Microsoft Teams to `channels()` and re-keyed the Slack channel from `slack` to `slack-channels`.

**Microsoft Teams**: projects with an active `microsoft-teams` platform connection now resolve a `TeamsProvider` automatically — no bot credentials in your code. The provider runs in delegated mode: connecting an agent provisions a dedicated Teams bot for it through the platform connection, and per-scope tokens (Microsoft Graph and Teams Dev Portal) are resolved fresh from the platform on every call.

**Breaking: Slack channel integration id renamed**. The Slack channel is now matched by the platform's `slack-channels` integration (the catalog rename over Nango's upstream `slack-app-configuration` TWO_STEP provider), which serves a Slack App Configuration token capable of minting per-agent apps via the manifest API. The plain `slack` OAuth integration continues to back the generated Slack **tools** — its bot token is scoped to a single installed workspace and cannot mint per-agent apps.

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
