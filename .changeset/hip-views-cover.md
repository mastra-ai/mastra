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

Channel sessions can also run in an isolated per-session workspace. Supply a `resolveSessionProjectPath` hook in the channels configuration to map each session's resource ID to its own workspace directory; the returned path seeds the session's `projectPath` so each chat thread gets its own workspace and can't run in or mutate another thread's. Omitting the hook keeps the default behavior (sessions share the controller's default workspace).
