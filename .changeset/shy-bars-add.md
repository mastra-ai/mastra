---
'@mastra/hono': patch
'@mastra/deployer': patch
---

Fixed unauthenticated access to agent browser streaming. The browser WebSocket stream (`/browser/:agentId/stream`), the session probe, and the close endpoint now require the same authentication as the rest of the server. Previously anyone who could reach the server could watch a live browser screen, send mouse and keyboard input to a running agent session, and force-close it, without any credentials.

Browser streaming is now denied with `401` unless the request carries a valid credential for the server auth provider configured on `Mastra`:

- Browser WebSocket upgrades authenticate with the session cookie that same-origin requests already send, so signed-in Studio sessions keep working. Because a WebSocket handshake cannot set headers, API clients can pass a token with the `apiKey` query parameter instead:

```ts
const ws = new WebSocket(`wss://example.com/browser/my-agent/stream?threadId=${threadId}&apiKey=${token}`);
```

- The session probe and close endpoints also accept a token through the `Authorization` header, like every other server endpoint.

**Direct callers of `setupBrowserStream`:** the config now requires the `mastra` instance so the browser routes can be authenticated.

Before:

```ts
await setupBrowserStream(app, { getToolset });
```

After:

```ts
await setupBrowserStream(app, { mastra, getToolset });
```
