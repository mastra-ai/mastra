---
'@mastra/core': patch
---

Fixed excessive CPU and allocation overhead when streaming through output processors by avoiding a workflow run for every chunk in generated processor chains.
