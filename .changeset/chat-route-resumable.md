---
'@mastra/core': minor
'@mastra/ai-sdk': minor
---

Added resumable AI SDK chat routes and explicit route-array inputs for server configuration.

Before:

```ts
chatRoute({ path: '/chat/:agentId' });
```

After:

```ts
const routes = chatRoute({ path: '/chat/:agentId', resumable: true });

const mastra = new Mastra({
  server: {
    apiRoutes: [routes],
  },
});
```

With `resumable: true`, `chatRoute()` returns an explicit `[postRoute, reconnectRoute]` tuple. Mastra accepts route arrays within `server.apiRoutes` and normalizes them once during server configuration, so `getServer().apiRoutes` remains a flat route list.

The companion `GET <path>/:chatId/stream` endpoint supports AI SDK's stock `useChat({ resume: true })` behavior. The POST chat ID becomes the Mastra memory thread ID, allowing the GET route to find, replay, and follow the active run through `agent.observe(runId)` without custom client transport configuration.

Resumable routes preserve AI SDK v5, v6, and v7 UI message streams, Editor agent version selection, SSE heartbeats, and resource/thread/FGA access checks. Disconnecting the POST response does not abort resumable runs, so abort-based cancellation is unavailable while resumability is enabled. Unknown, expired, inaccessible, or finished runs return 204.
