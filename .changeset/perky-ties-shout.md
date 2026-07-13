---
'@mastra/client-js': minor
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
---

Agent controller session state now reports run activity. `session.state()` responses include a `running` flag for initial UI hydration, and `session.listThreads()` results carry a per-thread `state` of `'active'` or `'idle'` so UIs can show which threads are mid-run.

```ts
const session = client.getAgentController('code').session(resourceId, scope);
const { threads } = await session.listThreads({ tags: { projectPath } });
const busy = threads.filter(t => t.state === 'active');
```
