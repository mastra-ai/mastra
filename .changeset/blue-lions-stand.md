---
'@mastra/core': patch
---

Fixed the internal notification dispatcher workflow leaving a dead workflow snapshot row behind on every run. Apps using deferred notifications accumulated one row per minute in mastra_workflow_snapshot indefinitely. Fixes #20254
