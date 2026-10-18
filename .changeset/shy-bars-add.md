---
'@mastra/hono': patch
'@mastra/deployer': patch
'mastra': patch
---

Agent browser streaming now requires authentication. The browser WebSocket stream (`/browser/:agentId/stream`), the session probe, and the close endpoint previously accepted unauthenticated requests; they now require the same authentication as the rest of the server.

Requests without a valid credential for the server auth provider configured on `Mastra` are denied with `401`.

Browser WebSocket upgrades authenticate with the session cookie that same-origin requests already send, so signed-in Studio sessions keep working. A WebSocket handshake cannot set an `Authorization` header, so a client that authenticates with a header first exchanges its credential for a single-use upgrade ticket over an authenticated HTTP request:

```ts
const response = await fetch(`${apiUrl}/agents/my-agent/browser/stream-ticket`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ threadId }),
});
const { ticket } = await response.json();

const ws = new WebSocket(`wss://example.com/browser/my-agent/stream?threadId=${threadId}&ticket=${ticket}`);
```

The ticket is opaque, expires after 30 seconds, is bound to the agent and thread it was issued for, and is consumed by the first upgrade it authenticates. The credential is only ever presented to the mint endpoint, so it never reaches a proxy or an access log, and each connection attempt mints a fresh ticket.

Issuance is bounded so the mint endpoint cannot be used to exhaust the server: each agent may request a limited number of tickets per minute and the process holds a capped number of unspent tickets, beyond which the endpoint answers `429` instead of allocating more.

For clients that cannot call the mint endpoint, `?apiKey=` remains available as a handshake-only fallback:

```ts
const ws = new WebSocket(`wss://example.com/browser/my-agent/stream?threadId=${threadId}&apiKey=${token}`);
```

A token in a URL can be retained in proxy and access logs, so prefer the ticket flow, and pass a short-lived token if you use this fallback. The mint endpoint, the session probe, and the close endpoint also accept the token through the `Authorization` header.

Studio's browser view follows the same rule: when Studio is configured with an `Authorization` header it requests an upgrade ticket for each connection, so a deployment that authenticates with a header keeps its live view instead of losing it to a `401`. Deployments that sign users in with a session cookie are unaffected.

`setupBrowserStream` also accepts an optional `allowedOrigins` allowlist, in the same shape as Hono's `cors.origin`, and refuses an upgrade from any other origin with `403` before authentication runs. Upgrades from the server's own origin are always allowed, since a CORS allowlist names other origins and Studio is often served by the same server; this check compares the host and not the scheme. The deployer forwards `server.cors.origin` when it is explicitly configured.

**Direct callers of `setupBrowserStream`:** the config now requires the `mastra` instance so the browser routes can be authenticated.

Before:

```ts
await setupBrowserStream(app, { getToolset });
```

After:

```ts
await setupBrowserStream(app, { mastra, getToolset });
```
