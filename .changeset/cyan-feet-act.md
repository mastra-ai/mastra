---
'@mastra/memory': minor
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added Observational Memory cloning when forking threads. Thread-scoped OM is cloned with remapped message IDs. Resource-scoped OM is shared when the resourceId stays the same, and cloned with remapped thread tags when the resourceId changes. Multi-generation OM history (including reflections) is preserved during cloning.
