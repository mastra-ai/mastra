---
'mastra': patch
---

Fixed `mastra studio deploy` and `mastra server deploy` so transient polling failures are retried up to 3 times before the CLI exits.
