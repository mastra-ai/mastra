---
'@mastra/server': minor
'@mastra/client-js': patch
'mastra': patch
---

Added `GET /observability/capabilities` endpoint that returns the list of observability HTTP endpoints supported by the current server configuration. Support is determined by combining the installed `@mastra/core` feature flags, the installed `@mastra/observability` feature flags, and the methods implemented by the connected observability storage adapter. UIs can call this once on load and hide or disable filters and panels that the server cannot back, instead of waiting for 500 errors from `/observability/discovery/*` calls.

```ts
// Example response shape
{
  storeProvider: 'ObservabilityPG',
  endpoints: [
    { method: 'GET', path: '/observability/traces' },
    { method: 'GET', path: '/observability/traces/:traceId' },
    { method: 'GET', path: '/observability/discovery/tags' },
    // ...only endpoints whose dependencies are satisfied
  ]
}
```
