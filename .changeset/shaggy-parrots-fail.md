---
"@mastra/core": patch
---

Fixed channel conversations (Slack, Discord, Telegram and others) never getting an automatic title. New channel threads now start without a title, like any other thread, so `generateTitle` names them from the conversation.

Before, every new channel thread was saved with a generic label such as `slack conversation`, which counted as an existing title and blocked title generation. With `generateTitle` turned off, new channel threads now appear untitled in Studio, which lists them by creation date, instead of showing that label. Existing threads keep their current title.
