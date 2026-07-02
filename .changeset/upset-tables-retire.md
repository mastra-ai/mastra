---
'@mastra/core': patch
---

Fixed `DurableAgent` persisting messages when `memory.options.readOnly` is true. It now honors `readOnly` like the non-durable agent and skips saving new messages, so ephemeral and PII-sensitive runs are no longer written to the thread.
