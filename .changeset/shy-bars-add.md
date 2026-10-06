---
'@mastra/hono': patch
'@mastra/deployer': patch
---

Agent browser streaming now requires authentication. The browser WebSocket stream (`/browser/:agentId/stream`), the session probe, and the close endpoint previously accepted unauthenticated requests; they now require the same authentication as the rest of the server.

Requests without a valid credential for the server auth provider configured on `Mastra` are denied with `401`.

Browser WebSocket upgrades authenticate with the session cookie that same-origin requests already send, so signed-in Studio sessions keep working. A WebSocket handshake cannot set an `Authorization` header, so a non-browser client can pass the token as the `apiKey` query parameter instead:

```ts
const ws = new WebSocket(`wss://example.com/browser/my-agent/stream?threadId=${threadId}&apiKey=${token}`);
```

A token in a URL can be retained in proxy and access logs, so pass a short-lived token. The session probe and close endpoints also accept the token through the `Authorization` header, which is the better choice for any client that can set one.

**Direct callers of `setupBrowserStream`:** the config now requires the `mastra` instance so the browser routes can be authenticated.

Before:

```ts
await setupBrowserStream(app, { getToolset });
```

After:

```ts
await setupBrowserStream(app, { mastra, getToolset });
```
