---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Added an actionable server warning when an agent channel webhook returns 404 because its channel adapter route was not registered.

Register the adapter before sending events to `POST /api/agents/your-agent/channels/slack/webhook`:

```typescript
import { Agent } from '@mastra/core/agent';
import { createSlackAdapter } from '@chat-adapter/slack';

const agent = new Agent({
  id: 'your-agent',
  name: 'Your Agent',
  instructions: 'Help users in Slack.',
  model: 'openai/gpt-5-mini',
  channels: {
    adapters: {
      slack: createSlackAdapter(),
    },
  },
});
```
