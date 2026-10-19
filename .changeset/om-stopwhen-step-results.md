---
'@mastra/core': patch
---

Fixed `stopWhen` receiving an empty last step (no content or tool results) when Observational Memory is enabled. Observational Memory moves earlier response messages into memory between steps, which threw off how the loop located the current step's content. The loop now reads each step's content from where that step was recorded. (#24224)
