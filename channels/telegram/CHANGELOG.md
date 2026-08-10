# @mastra/telegram

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/telegram` for connecting Mastra agents to Telegram bots. It supports multiple bots, webhook or polling delivery, commands, and streaming replies, and ships a dual ESM + CJS build. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt stored bot tokens and webhook secret tokens at rest. ([#19975](https://github.com/mastra-ai/mastra/pull/19975))

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

### Patch Changes

- Updated dependencies [[`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a)]:
  - @mastra/core@1.58.0-alpha.10
