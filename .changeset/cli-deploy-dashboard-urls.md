---
'mastra': patch
---

Deploy diagnosis and failure output now build dashboard links through one helper. The links no longer carry the retired `/studio/` and `/server/` path segments, server deploys point at the `server-deploys` page directly, and every link follows the platform API host, so a staging deploy links to the staging dashboard instead of production.
