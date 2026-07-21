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

Registering the controller on a `Mastra` instance exposes a webhook route per adapter at `/api/agent-controllers/<CONTROLLER_ID>/channels/<PLATFORM>/webhook`. Adapters can be constructed manually here; provider-managed connect flows (such as Slack's controller-owned installations) are also supported. Controller channels need a long-lived server.

Controller channels attach to the backing agent instance (via `setChannels`, propagated to every backing agent including per-mode agents) rather than being stamped onto each run's request context. Only agents explicitly given channels attach the channel output processor, so child runs such as observational-memory observers and forked subagents no longer render to the chat platform.

Channel tools (`send_message`, `add_reaction`, and friends) are no longer auto-injected into an agent's resolved toolset. If you want your agent to act on a channel run — send a message, add a reaction — pass the chat tools to your agent explicitly. `AgentChannels.getTools()` is now `@deprecated` but remains functional. An agent with channels that resolves a toolset containing no channel tools logs a one-time warning pointing at this migration.

Inbound channel messages routed into a controller session keep their platform metadata: the message's `providerOptions` (author name, user ID, message ID, and so on under `mastra.channels.<PLATFORM>`) are stamped onto the persisted user message as `content.providerMetadata`, matching the plain agent channel path.
