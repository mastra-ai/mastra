---
'@mastra/core': patch
---

Fix observability log correlation: logs emitted from inside an agent run were being persisted with `entityId`, `runId`, `traceId`, and the other correlation fields set to `null`, breaking trace ↔ log linking in Mastra Studio and downstream observability tools. Logs now correctly carry the active span's correlation context end to end.
