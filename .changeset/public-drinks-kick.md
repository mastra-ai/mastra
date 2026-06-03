---
'@mastra/libsql': patch
---

Fixed LibSQL memory cleanup so in-memory stores initialize their tables before clearing data. This prevents reset flows from failing with missing table errors such as mastra_resources.
