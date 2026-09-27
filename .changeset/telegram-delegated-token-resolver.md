---
'@mastra/telegram': minor
---

Added delegated credential mode to `TelegramProvider` via a new `tokenResolver` option. When set, the provider resolves a fresh bot token from your credential manager before every Bot API call and never persists the token itself — installations store the bot's user id instead so duplicate connections are still detected. Combining `tokenResolver` with a static `botToken` is rejected at compile time and at runtime.
