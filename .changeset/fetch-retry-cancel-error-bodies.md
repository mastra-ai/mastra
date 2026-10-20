---
'@mastra/core': patch
---

Fixed `fetchWithRetry` leaving the bodies of failed HTTP responses open when it retried or gave up, which could keep connections busy until garbage collection. Failed responses are now cancelled before retrying or throwing; successful responses are still returned unread.
