---
'@mastra/memory': minor
---

Added compact observer failure details and a reference to the failed memory-operation span when Observational Memory interrupts an agent. Observer context-window exhaustion is recorded as a limit, while the affected agent records an interruption.

Failure markers in streams and persisted messages, and tripwire metadata, now include `observerFailure` with the observer span reference and failure classification.
