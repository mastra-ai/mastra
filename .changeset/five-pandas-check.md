---
'@mastra/factory': patch
'mastra': patch
---

Improved model selection in Factory chats. The status line now shows one combined picker with the effective model for the current mode.

The picker offers:

- Model packs as presets, with your personal default marked.
- Models grouped by provider, to override the model for the current mode.
- A reset action that returns the chat to your default pack.
- A link to pack management in settings.
- Search across packs and models.

The picker works in draft chats and in active user chats. A pack chosen in a draft applies before the first prompt runs. Live user chats can now switch models directly from the status line.
