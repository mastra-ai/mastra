---
'@mastra/core': minor
'@mastra/ai-sdk': minor
---

Added reconnectable AI SDK chat routes and explicit route-array inputs for server configuration.

Before:

```ts
chatRoute({ path: '/chat/:agentId' });
```

After:

```ts
const routes = chatRoute({ path: '/chat/:agentId', reconnect: true });

const mastra = new Mastra({
  server: {
    apiRoutes: [routes],
  },
});
```

With `reconnect: true`, `chatRoute()` returns an explicit `[postRoute, reconnectRoute]` tuple. Mastra accepts route arrays within `server.apiRoutes` and normalizes them once during server configuration, so `getServer().apiRoutes` remains a flat route list.

The companion `GET <path>/runs/:runId` endpoint replays and follows a client-owned run through `agent.observe(runId)`. Generate a fresh `runId` for each POST and retain it for reconnects. When using AI SDK's `DefaultChatTransport`, configure `prepareReconnectToStreamRequest` to point to `<path>/runs/<runId>`; its default `<api>/<chatId>/stream` URL does not match this run-based endpoint.

Reconnects preserve AI SDK v5, v6, and v7 UI message streams, Editor agent version selection, SSE heartbeats, and resource/thread/FGA access checks. Disconnecting the POST response does not abort reconnect-enabled runs. Unknown, expired, or finished runs return 204.
