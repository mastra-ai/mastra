---
'@mastra/core': patch
---

Fix `DurableAgent` persisting messages when `memory.options.readOnly` is `true`. The durable finish path saved via the save queue directly, bypassing the `MessageHistory` processor that enforces `readOnly` in the non-durable path, so messages were written against the caller's explicit "read but don't save" instruction. The durable path now honors `readOnly` and skips persistence, matching the non-durable agent. Closes #18771.
