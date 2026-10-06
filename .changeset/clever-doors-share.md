---
'mastra': patch
---

Fixed concurrent CLI commands logging each other out by coordinating credential refresh across processes. Token refresh now takes a cross-process lock, re-reads credentials rotated by another process instead of submitting a stale refresh token, and writes the credentials file atomically.
