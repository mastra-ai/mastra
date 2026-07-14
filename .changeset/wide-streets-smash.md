---
'@mastra/server': minor
'@mastra/client-js': minor
'mastra': patch
---

Added run activity reporting to agent controller sessions. `session.state()` responses include a `running` flag so UIs can show a working indicator immediately when attaching to a session that is already mid-run, and each thread returned by `session.listThreads()` carries a `state` of `'active'` or `'idle'` (backed by the same per-thread run tracking that signal `ifIdle` delivery uses), so one listing can power activity indicators across every worktree or scope sharing a resource instead of polling each session:

```ts
const session = client.getAgentController('code').session(resourceId);

const { running } = await session.state(); // is the session mid-run?

const threads = await session.listThreads({ tags: { projectPath } });
const busy = threads.filter(thread => thread.state === 'active');
```
