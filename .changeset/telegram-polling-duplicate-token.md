---
'@mastra/telegram': patch
---

Fixed polling mode allowing the same Telegram bot to be connected to more than one agent. The second `connect()` now fails with the same "already connected" error as webhook mode, instead of starting a second poll loop that conflicts with the first.
