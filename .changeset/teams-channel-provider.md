---
'@mastra/teams': minor
---

Added @mastra/teams, a Microsoft Teams channel provider. Register `TeamsProvider` on `Mastra.channels` to route Teams conversations to agents with streaming replies.

Two credential modes are supported. Self-managed mode uses an existing bot registration's `appId`/`appPassword`. Delegated mode takes a scope-aware `tokenResolver` and provisions a dedicated bot per agent through Microsoft Graph and the Teams Developer Portal.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { TeamsProvider } from '@mastra/teams';

const teams = new TeamsProvider({
  baseUrl: 'https://my-app.example.com',
  appId: process.env.TEAMS_APP_ID,
  appPassword: process.env.TEAMS_APP_PASSWORD,
});

const mastra = new Mastra({
  agents: { myAgent },
  channels: { teams },
});

await teams.connect('my-agent');
```
