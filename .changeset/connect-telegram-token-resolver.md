---
'@mastra/connect': patch
---

Telegram channels now run in delegated credential mode: the provider receives a platform-backed `tokenResolver` instead of a static bot token, so a token re-pasted or rotated on the platform takes effect on the very next Bot API call without a snapshot refresh, and the bot token is never persisted in provider storage.
