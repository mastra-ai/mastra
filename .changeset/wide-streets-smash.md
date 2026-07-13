---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
'mastra': patch
---

Agent controller thread listings now report run activity. The session state response includes a `running` flag, and each thread returned by `GET /agent-controller/:controllerId/sessions/:resourceId/threads` carries a `state` of `active` or `idle` (backed by the same per-thread run tracking that signal `ifIdle` delivery uses), so UIs can show activity indicators from a single listing instead of polling per session.

```ts
const session = client.getAgentController('code').session(resourceId);

const { running } = await session.state(); // is the session mid-run?

const threads = await session.listThreads({ tags: { projectPath } });
const busy = threads.filter(thread => thread.state === 'active');
```
