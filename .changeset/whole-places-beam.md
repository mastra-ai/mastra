---
'mastra': patch
---

Fixed `mastra server deploy` getting stuck in `queued` after transient upload confirmation failures. The CLI now retries these failures and cleans up failed deploys so they no longer remain orphaned.
