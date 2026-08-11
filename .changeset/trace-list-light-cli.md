---
'mastra': patch
---

Added the delta polling parameters (`mode`, `after`, `limit`) to the lightweight trace list route in `mastra api`'s route metadata, so a polling client can fetch only the traces recorded since its last request:

```bash
mastra api trace list '{"mode":"delta","after":"<deltaCursor>","limit":100}'
```

Each response returns a `deltaCursor` to pass as `after` on the next poll.
