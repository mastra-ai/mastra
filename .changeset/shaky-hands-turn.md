---
'@mastra/factory': patch
---

Added external tracker sync for Factory work item transitions. When a Factory rule emits an updateExternalSource or commentExternalSource decision, the decision dispatcher now updates the linked GitHub or Linear issue state or posts a comment on it, using the integration that owns the work item's external source. Sync failures are retried in the background and never block the internal transition.
