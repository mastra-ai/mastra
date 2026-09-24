---
'@mastra/telegram': patch
---

Fixed Telegram webhook connections so reusing a bot token for another agent is rejected instead of replacing the existing webhook. Clarified how connect() uses a default bot token.
