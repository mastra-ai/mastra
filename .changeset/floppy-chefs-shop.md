---
'@mastra/core': patch
'@mastra/server': patch
---

Reduced agent-controller memory usage during long streamed responses by reusing the live accumulated message across `message_start`, `message_update`, and `message_end` events, including events queued for server-sent event delivery. `display_state_changed.currentMessage` references the same live message. Consumers that require point-in-time values should copy or serialize before deferring event processing.
