---
'@mastra/factory': patch
---

Fixed cached Factory workspaces retaining stale GitHub credentials after their run-binding role or configured credential source changes. Worker and reviewer identities are now reconciled on reuse, and cleared PATs fall back to repository credentials.
