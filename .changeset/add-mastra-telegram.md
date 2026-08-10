---
'@mastra/telegram': minor
---

Added `@mastra/telegram` for connecting Mastra agents to Telegram bots. It supports multiple bots, webhook or polling delivery, commands, and streaming replies, and ships a dual ESM + CJS build. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt stored bot tokens and webhook secret tokens at rest.

```ts
import { Mastra } from '@mastra/core';
import { TelegramProvider } from '@mastra/telegram';

const telegram = new TelegramProvider();

export const mastra = new Mastra({
  agents: { support },
  channels: { telegram },
});

// Paste a BotFather token to connect an agent instantly:
const result = await telegram.connect('support', { botToken: process.env.TELEGRAM_BOT_TOKEN });
// → { type: 'immediate', installationId: '...' }
```
