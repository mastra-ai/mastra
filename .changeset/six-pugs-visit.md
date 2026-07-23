---
'@mastra/server': patch
---

Added dataset item `timeout` fields and the experiment trigger `itemTimeout` fallback to the server API. For example, create an item with `{ "input": "...", "timeout": 5000 }` and trigger its experiment with `{ "targetType": "agent", "targetId": "agent", "itemTimeout": 30000 }`.
