---
'@mastra/dsql': patch
---

Fixed DSQL memory timestamps to stay aligned across server timezones. Thread and resource `createdAt`/`updatedAt` were bound to the driver as raw `Date` objects, which node-postgres renders in the process's local timezone, so `timestamp` columns stored local wall clock instead of the instant.
