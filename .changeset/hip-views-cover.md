---
'@mastra/core': minor
---

Added chat channel support to `AgentController`. Configure `channels` with Chat SDK adapters (Slack, Discord, Telegram, and more) to run a controller-backed agent session inside a messaging thread: each chat thread maps to one durable controller session, the agent's streamed output renders back to the platform with native streaming, tool approval cards, and typing status, and tool approvals resolve through the session's approval gate.

```typescript
import { AgentController } from '@mastra/core/agent-controller';
import { createSlackAdapter } from '@chat-adapter/slack';

const agentController = new AgentController({
  id: 'my-agent',
  agent,
  modes,
  channels: {
    adapters: {
      slack: createSlackAdapter(),
    },
  },
});
```

Registering the controller on a `Mastra` instance exposes a webhook route per adapter at `/api/agent-controllers/<CONTROLLER_ID>/channels/<PLATFORM>/webhook`. V1 expects manually constructed adapters and a long-lived server.
