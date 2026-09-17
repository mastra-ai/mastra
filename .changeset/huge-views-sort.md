---
'@mastra/koa': patch
---

Fixed Koa error handling to preserve structured HTTP exception responses, including their status, headers, error codes, and details. Agent label conflicts and unsupported-storage errors now reach clients without being reduced to plain messages.
