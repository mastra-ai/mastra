---
'@mastra/telegram': patch
---

Fixed Telegram showing as "Not configured" in Studio when a bot token was available. `getInfo().isConfigured` previously only turned true after an agent had already been connected, so UIs hid the Connect button for a provider that was fully ready — including delegated mode, where `@mastra/connect` supplies the platform-stored bot token through a `tokenResolver`. The provider now reports configured whenever a credential source exists (a default `botToken` or a `tokenResolver`).

```ts
// before: isConfigured === false until the first successful connect()
// after: a credential source is enough
const telegram = new TelegramProvider({ tokenResolver: async () => platformToken });
telegram.getInfo().isConfigured; // true
```
