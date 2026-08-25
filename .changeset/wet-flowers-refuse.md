---
'@mastra/factory': minor
---

Removed the `/ensure` endpoint from the GitHub web routes. Opening a chat session no longer calls it: session sandboxes boot lazily at the first real command, so the endpoint had nothing left to provision and returned only metadata the client never read. The "preparing sandbox" step and the warm-up error banner are gone from the session UI along with it, since neither described work that still happens. To check whether a sandbox is configured, read `sandboxEnabled` from `GET /web/github/status`.

**Clearer failure for the old sandbox config**

A factory still configured with the pre-callback options object now fails at `prepare()` with a message showing what to write instead, rather than only naming the expected type:

```ts
// Before — no longer accepted
sandbox: { enabled: true, provider: 'e2b', maxSandboxes: 4 }

// After — a callback that constructs the session's sandbox
sandbox: ctx => new E2BSandbox({ id: ctx.sessionId })
```

Provider options such as idle timeouts move onto the provider you construct inside the callback. Omit `sandbox` entirely to run without sandboxes.
