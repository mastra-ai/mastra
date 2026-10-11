---
'@mastra/factory': patch
---

Faster rule processing on large Factory projects. Rule evaluations are now indexed by their ingress event, so looking up whether an event was already evaluated no longer scans every evaluation ever recorded.
