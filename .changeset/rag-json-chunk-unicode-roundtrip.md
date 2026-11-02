---
'@mastra/rag': patch
---

Fixed JSON chunking so each chunk round-trips through a single `JSON.parse`. With `ensureAscii` enabled (the default), non-ASCII keys and values are now escaped once instead of being double-escaped. With `ensureAscii: false`, literal `\uXXXX` text in values is no longer decoded into characters. If you were decoding chunk values a second time to work around this, remove that step.
