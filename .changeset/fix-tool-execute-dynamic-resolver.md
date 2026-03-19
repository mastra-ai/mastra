---
"@mastra/server": patch
---

Tools registered via agent toolsResolvers can now be executed through the tool execution endpoint. Previously, dynamically-resolved tools were not discoverable and would return 404.
