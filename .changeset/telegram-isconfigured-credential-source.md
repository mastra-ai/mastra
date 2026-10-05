---
'@mastra/telegram': patch
---

Fixed Telegram showing as "Not configured" in Studio even though a bot credential was available, which hid the Connect button for a channel that was fully ready to connect. Telegram now reports configured as soon as a credential source exists instead of only after the first agent has connected.

```ts
// before: isConfigured === false until the first successful connect()
// after: a credential source is enough
const telegram = new TelegramProvider({ tokenResolver: async () => platformToken });
telegram.getInfo().isConfigured; // true
```
