---
'@mastra/hono': patch
'@mastra/deployer': patch
'mastra': patch
---

Agent browser streaming now requires authentication. The browser WebSocket stream (`/browser/:agentId/stream`), the session probe, and the close endpoint previously accepted unauthenticated requests; they now require the same authentication as the rest of the server.

Requests without a valid credential for the server auth provider configured on `Mastra` are denied with `401`.

Browser WebSocket upgrades authenticate with the session cookie that same-origin requests already send, so signed-in Studio sessions keep working. A WebSocket handshake cannot set an `Authorization` header, so a non-browser client can pass the token as the `apiKey` query parameter instead:

```ts
const ws = new WebSocket(`wss://example.com/browser/my-agent/stream?threadId=${threadId}&apiKey=${token}`);
```

A token in a URL can be retained in proxy and access logs, so pass a short-lived token. The session probe and close endpoints also accept the token through the `Authorization` header, which is the better choice for any client that can set one.

Studio's browser view follows the same rule: when Studio is configured with an `Authorization` header it now sends that token on the WebSocket URL, so a deployment that authenticates with a header keeps its live view instead of losing it to a `401`. Deployments that sign users in with a session cookie are unaffected.

`setupBrowserStream` also accepts an optional `allowedOrigins` allowlist, in the same shape as Hono's `cors.origin`, and refuses an upgrade from any other origin with `403` before authentication runs. Upgrades from the server's own origin are always allowed, since a CORS allowlist names other origins and Studio is often served by the same server. The deployer forwards `server.cors.origin` when it is explicitly configured.

**Direct callers of `setupBrowserStream`:** the config now requires the `mastra` instance so the browser routes can be authenticated.

Before:

```ts
await setupBrowserStream(app, { getToolset });
```

After:

```ts
await setupBrowserStream(app, { mastra, getToolset });
```
