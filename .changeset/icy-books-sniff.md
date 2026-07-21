---
'mastra': patch
---

Fixed a crash in mastra worker start when a worker subprocess writes a very large amount of stderr output. The output is now capped to the most recent 1MB instead of growing without limit.
