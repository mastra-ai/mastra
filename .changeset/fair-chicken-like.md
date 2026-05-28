---
'@mastra/core': patch
---

Fixed processor-returned `systemMessages` wiping tagged system messages owned by other processors (e.g. observational memory). Tagged messages are now preserved across both the legacy processor runner path and the workflow-step processor path used by `agent.generate()`/`agent.stream()`, so memory context no longer disappears or duplicates when a later processor returns `{ messages, systemMessages }`.
