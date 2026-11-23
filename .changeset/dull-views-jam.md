---
'@mastra/platform': patch
'@mastra/server': patch
'@mastra/core': patch
---

The memory status, memory config, observational memory and buffer-status routes now read Observational Memory from the agent's memory when the memory runs it (for example PlatformMemory). Thread access checks still apply, and an empty hosted result is returned as empty instead of falling back to local storage.
