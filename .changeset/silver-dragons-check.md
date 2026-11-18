---
'@mastra/core': patch
---

Fixed notifications being recorded as delivered when the target thread could not accept the signal. A blocked delivery now stays pending and is retried, instead of being silently dropped.
