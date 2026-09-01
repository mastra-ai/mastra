# @mastra/telegram

Telegram integration for Mastra agents — a ChannelProvider over @chat-adapter/telegram with webhooks, secret verification, commands, and streaming replies. Use `@mastra/telegram` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/telegram
```

## Usage

Set `TELEGRAM_BOT_TOKEN` to the token issued by BotFather.

```typescript
import { TelegramProvider } from '@mastra/telegram';

const telegram = new TelegramProvider({ mode: 'polling' });
await telegram.connect('support-agent', {
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
```

## Documentation

- [@mastra/telegram documentation](https://mastra.ai/reference/channels/channel-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/channels/telegram/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
