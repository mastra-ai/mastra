---
'@mastra/core': patch
---

Fixed a race that could cause an immediate auto-resume of a suspended tool call to fail on some storage backends. Resume now succeeds reliably whether the underlying storage is fast or slow.

Fixes [#16158](https://github.com/mastra-ai/mastra/issues/16158).
