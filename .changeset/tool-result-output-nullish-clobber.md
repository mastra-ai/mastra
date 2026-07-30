---
'@mastra/core': patch
---

Fixed durable Agent conversations crashing on a later turn after a tool returned a text-only result, which previously left the thread stuck and unable to continue. Durable runs also no longer store the empty mapping result on the message, matching regular agents, so existing conversations recover and new ones stay clean.
