---
'@mastra/memory': patch
---

Fixed observational memory forcing an Observer call on nearly every step once its own observations outgrew the message threshold. Provider-reported context usage now subtracts the non-message overhead the provider charged (system prompt, observations and tool definitions, taken as the smallest input minus message estimate seen in the run), and with async buffering it only forces a blocking observation at `blockAfter`.
