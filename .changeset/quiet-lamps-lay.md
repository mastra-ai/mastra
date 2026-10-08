---
'@mastra/libsql': patch
---

Fixed memory writes failing with `SQLITE_BUSY` when another process briefly holds the database lock. Saving messages, updating or deleting threads, and observational memory writes now retry with backoff, like other LibSQL storage writes. This is controlled by the existing `maxRetries` and `initialBackoffMs` options.
