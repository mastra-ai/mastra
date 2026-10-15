---
'@mastra/server': patch
---

Exported `RESERVED_REQUEST_CONTEXT_KEYS` from `@mastra/server/server-adapter`: the read-only list of request context keys a request body can never set. `isReservedRequestContextKey` now checks against this same list, so server adapters and their tests can verify every reserved key without keeping their own copy.
