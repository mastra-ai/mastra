---
'@mastra/server': patch
---

Added `requestContextSchema` and conditional field validation to stored agent API schemas. The stored agent create, update, and version endpoints now accept conditional variants for dynamically-configurable fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`).
