---
'@mastra/factory': patch
---

Fixed cached Factory workspaces retaining stale GitHub credentials after their run-binding role changes. Worker and reviewer identities are now reconciled on reuse, including worker and repository-token fallback behavior.
