---
'@mastra/telegram': minor
---

Added `@mastra/telegram` — a Telegram channel wrapper (`ChannelProvider`) for Mastra agents, to parity with `@mastra/slack`. It wraps the `@chat-adapter/telegram` protocol adapter and adds the install/lifecycle layer: a multi-bot token store, `setWebhook` + secret-token verification, `setMyCommands` command registration, webhook/polling transport selection, and post-and-edit streaming with a typing keepalive. Bot tokens/secrets are encrypted at rest. Ships a dual ESM + CJS build.

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
