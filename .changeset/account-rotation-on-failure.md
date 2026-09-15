---
'@mastra/code-sdk': patch
'mastracode': patch
---

Rotate OAuth accounts automatically on request failure. When the active account is rate-limited, quota-exhausted, or fails auth (after one forced token refresh), Mastra Code activates the next account in the pool and retries the request; server errors and outages exhaust the transient retry budget first, then surface (or hop to a configured fallback pack). Every switch appears in the transcript as a one-line notice and is persisted in thread history.
