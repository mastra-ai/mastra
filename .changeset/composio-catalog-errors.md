---
'@mastra/editor': patch
---

Fixed Composio catalog failures being reported as successful empty results. Catalog errors now propagate so applications can distinguish outages and authorization failures from a valid catalog with no matching tools. Fixes #24248.
