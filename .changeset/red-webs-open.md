---
'@mastra/factory': minor
---

Added automatic GitHub and Linear issue reconciliation so Factory work items stay current when provider metadata changes outside Factory. Platform Linear now runs a dedicated event worker that tails the Platform event stream, replays Issue webhooks through the shared Linear rules ingress, and folds in the periodic reconcile sweep on a cadence.
