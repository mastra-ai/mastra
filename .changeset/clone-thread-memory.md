---
'@mastra/memory': minor
---

Added Observational Memory cloning when forking threads. Thread-scoped OM is cloned with remapped message IDs. Resource-scoped OM is shared when the resourceId stays the same, and cloned with remapped thread tags when the resourceId changes. Only the current OM generation is cloned (older history generations are not copied). If OM cloning fails, the already-persisted thread clone is rolled back.
