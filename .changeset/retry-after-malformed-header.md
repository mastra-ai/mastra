---
'@mastra/core': patch
---

A malformed `Retry-After` header no longer produces a decades-long retry delay. A value that is numeric but not the delay-seconds form (`-3`, `+3`, `1.5`) fell through to `Date.parse`, which reads a bare number as a year, so `getRetryAfterMs` returned a timestamp roughly 31 years out instead of `undefined`. Both callers cap the delay, so every retry stalled for the full 30s cap rather than using normal exponential backoff, and the bogus value also shadowed a usable `Retry-After` deeper in the error's `cause` chain. Such values are now rejected before the HTTP-date fallback.
