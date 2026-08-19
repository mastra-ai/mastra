---
'@mastra/factory': patch
'mastra': patch
---

Improved model selection in Factory chats with a single combined picker: the status line now shows the effective model for the current mode, and its searchable menu offers model packs as presets (with the personal default marked), models grouped by provider for per-mode overrides, a reset to the default pack, and a deep link to pack management in settings. The picker works in draft and active user chats, applies a draft selection before the first prompt runs, and live user chats can now switch models directly.
