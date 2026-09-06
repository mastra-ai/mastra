---
'@mastra/factory': patch
---

Added a durable automation-run ingress for trusted external orchestrators.

External controllers can now enqueue one revision-checked, idempotent Factory skill invocation for an existing work item without pre-creating a source-control session. Factory's existing decision dispatcher remains responsible for approval policy, binding, delivery, retries, and restart recovery.
