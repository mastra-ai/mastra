---
'@mastra/inngest': patch
'@mastra/core': patch
---

Tool payload transforms now persist their state on the durable engine. Transcript-target transforms correctly redact stored args and results in thread history; previously only the streamed chunks were transformed and raw values were silently persisted.
