---
'mastra': patch
---

Added `on` to `mastra api factory intake-route create` and `update`, and allowed `event.type` and `event.reason` in route conditions. `on` is a field of the JSON body:

```bash
# Send reopened issues to Triage by editing the default reopen route.
PROJECT_ID=your-project-id
ROUTE_ID=your-reopen-route-id
mastra api factory intake-route update "$PROJECT_ID" "$ROUTE_ID" '{"target":{"boardKey":"work","phaseKey":"triage"},"expectedRevision":1}'
```
