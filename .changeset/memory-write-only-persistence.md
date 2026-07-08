---
'@mastra/core': patch
---

Fix: `lastMessages: false` no longer disables message persistence (enables write-only memory)

`MessageHistory` handles both recall (input) and saving (output). Previously it was
registered on the output side only when `lastMessages` was truthy, so `lastMessages: false`
silently dropped the save — a thread was created but no messages were persisted. This
contradicted the documented semantics ("To prevent saving new messages, use the `readOnly`
option instead") and made a one-way / write-only memory impossible.

The save (output) processor is now registered independent of `lastMessages`; recall stays
gated on `lastMessages` (input side), and saving is disabled via `readOnly` (checked at
execution). `lastMessages: false` therefore acts as a write-only memory: no recalled history
is injected into the prompt, but each turn is still persisted. The missing-storage-adapter
guard is preserved. Fixes #19149.
