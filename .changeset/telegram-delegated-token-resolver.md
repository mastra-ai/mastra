---
'@mastra/telegram': minor
---

Added delegated credential mode to `TelegramProvider` via a new `tokenResolver` option. When set, the provider resolves a fresh bot token from your credential manager before every Bot API call and never persists the token itself — installations store the bot's user id instead so duplicate connections are still detected. Combining `tokenResolver` with a static `botToken` is rejected at compile time and at runtime.

```ts
import { TelegramProvider } from '@mastra/telegram';

const telegram = new TelegramProvider({
  // Called before every Bot API call — return the current token from your
  // credential store. Never combine with a static `botToken`.
  tokenResolver: async () => await myVault.getTelegramBotToken(),
});
```
