---
'@mastra/client-js': minor
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
---

Added `session.running()` to the agent controller client — a non-creating peek that reports whether a session is currently executing a run. `session.state()` responses now also include a `running` flag for initial UI hydration.

```ts
const session = client.getAgentController('code').session(resourceId, scope);
const { running } = await session.running(); // false when no live session exists
```
