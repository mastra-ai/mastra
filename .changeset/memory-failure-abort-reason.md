---
'@mastra/core': minor
---

A run stopped by an observational-memory observer or reflector failure now ends with `agent_end` `abortReason: 'memory-failure'`. The reason stays `'aborted'`, so existing handling is unchanged; callers can now tell this abort apart from a person stopping the run, and show the `error` event that precedes it.
