---
'@mastra/upstash': patch
---

Fixed Upstash Vector filters so `{ field: { $not: { $nin: [...] } } }` translates to `field IN (...)` instead of an invalid inequality.
