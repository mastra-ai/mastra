---
'@mastra/core': patch
---

Fixed durable Agent conversations crashing on a later turn after a tool returned a text-only result, which previously left the thread stuck and unable to continue.
