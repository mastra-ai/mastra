---
"@mastra/mcp": minor
---

Add `serverlessStreaming` option to `MCPServer.startHTTP()` for request-scoped progress notifications in serverless mode.

Serverless mode (`serverless: true`) buffers each request into a single JSON response, which silently drops any `notifications/progress` a tool emits via `extra.sendNotification()`. Setting `options: { serverless: true, serverlessStreaming: true }` now handles the request with request-scoped SSE streaming (`enableJsonResponse: false` on the transient transport), so progress notifications reach the MCP client's `onprogress` handler before the final result. An explicit `enableJsonResponse` is also honored.

This is still fully stateless — no `mcp-session-id` is required or persisted — and the default behavior is unchanged (`enableJsonResponse: true`), so existing serverless JSON-response users are unaffected. It enables only notifications scoped to the current request, such as progress; elicitation, resource subscriptions, and out-of-request resource/list-change notifications still require session state.
