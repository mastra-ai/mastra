---
'@mastra/memory': minor
---

Added per-record config overrides for observation and reflection thresholds in Observational Memory. Each thread can now have its own `messageTokens` and `observationTokens` thresholds that override the instance-level defaults, without requiring a process restart or cache invalidation. If no per-record override is set, the instance-level config is used as before.
