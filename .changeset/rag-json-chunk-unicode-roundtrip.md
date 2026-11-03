---
'@mastra/rag': patch
---

Fixed JSON chunking so each chunk round-trips through a single `JSON.parse`. With `ensureAscii` enabled (the default), non-ASCII characters in keys and values are now escaped once instead of being returned as literal `\uXXXX` text. With `ensureAscii: false`, string values that contain literal `\uXXXX` text are no longer decoded. If your code decodes chunk values a second time to work around the old behavior, remove that step.
