---
'@mastra/mcp': minor
---

Added `MCPEventsSignalProvider` (experimental), which delivers events from MCP servers to agent threads as notifications. Occurrences reach the model as clearly marked untrusted data, threads on the same event share one server subscription, and a pluggable cursor store lets a thread that is subscribed again after a restart continue from its last cursor. Thread subscriptions themselves are kept in memory, so the app subscribes its threads again on startup. Optional tools let the agent list, subscribe to and unsubscribe from events itself.

The MCP Events extension (SEP-3415) is a draft, so this API may change.

```typescript
import { Agent } from '@mastra/core/agent';
import { MCPClient, MCPEventsSignalProvider } from '@mastra/mcp';

const mcp = new MCPClient({ servers: { github: { url: new URL('https://example.com/mcp') } } });
const repoEvents = new MCPEventsSignalProvider({ client: mcp, tools: { servers: ['github'] } });

const agent = new Agent({
  id: 'repo-agent',
  name: 'Repo Agent',
  instructions: 'Triage repository activity.',
  model: 'openai/gpt-5.6-sol',
  signals: [repoEvents],
});

await repoEvents.subscribeThread(
  { resourceId: 'user-1', threadId: 'thread-1' },
  { server: 'github', event: 'repo.push', args: { repo: 'mastra-ai/mastra' } },
);
```
