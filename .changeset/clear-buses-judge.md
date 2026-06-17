---
'@mastra/core': patch
---

Fixed signal providers losing memory access when harness forks agents per mode. Harness now propagates runtime services (memory, storage, etc.) to the base config agent during init so signal providers connected to it can deliver notifications.
