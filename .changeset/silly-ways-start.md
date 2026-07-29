---
'@mastra/factory': patch
---

Fix Factory workspaces not being available to HTTP routes immediately after creation. Sessions now consistently reuse the same workspace across requests.
