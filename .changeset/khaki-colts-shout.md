---
'@mastra/factory': patch
---

Fixed cached Factory workspaces retaining the wrong GitHub identity after their run-binding role changes. Worker and reviewer credentials are now reconciled on reuse, including falling back from stale reviewer credentials when no worker PAT is configured.
