---
'mastra': patch
---

Added `on` and `allowWorkingPhase` to `mastra api factory intake-route create` and `update`, and allowed `event.type` and `event.reason` in route conditions. Both are fields of the JSON body:

```bash
# Send reopened issues to Triage by editing the default reopen route.
PROJECT_ID=your-project-id
ROUTE_ID=your-reopen-route-id
mastra api factory intake-route update "$PROJECT_ID" "$ROUTE_ID" '{"target":{"boardKey":"work","phaseKey":"triage"},"allowWorkingPhase":true,"expectedRevision":1}'
```
