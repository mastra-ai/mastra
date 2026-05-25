---
'@mastra/convex': minor
---

Convex can now persist channel installations and provider configuration.

```ts
import { ConvexStore } from '@mastra/convex';

const storage = new ConvexStore({
  id: 'app-storage',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});

const channels = await storage.getStore('channels');

await channels?.saveInstallation({
  id: 'slack-agent-1',
  platform: 'slack',
  agentId: 'agent-1',
  status: 'active',
  webhookId: 'webhook-1',
  data: { teamId: 'T123', botUserId: 'U123' },
  createdAt: new Date(),
  updatedAt: new Date(),
});
```
