---
'@mastra/memory': patch
---

Fixed observational memory forcing an Observer call on nearly every step once its own observations outgrew the message threshold. Provider-reported context usage now excludes system messages (including OM's observations) and tool definitions measured at the previous request, so only message content counts toward the message budget.
