---
'@mastra/memory': patch
---

Fixed Observational Memory calls continuing after an agent run is cancelled. Observer and Reflector calls now stop with their owning run, while background work retained by another live turn can finish. Fixes #27792.
