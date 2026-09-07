# @mastra/telegram

`@mastra/telegram` connects Mastra agents to Telegram through the Bot API. It handles bot installations, polling or webhook delivery, secret-token verification, commands, rich messages, and Mastra's channel lifecycle.

## Installation

```bash
npm install @mastra/telegram
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { TelegramProvider } from '@mastra/telegram';

const supportAgent = new Agent({
  id: 'support',
  name: 'Support agent',
  instructions: 'Help users with product questions.',
  model: 'openai/gpt-5-mini',
});

const telegram = new TelegramProvider({
  baseUrl: 'https://your-app.example.com',
});

export const mastra = new Mastra({
  agents: { supportAgent },
  channels: { telegram },
});

await telegram.connect('support', {
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
```

## Documentation

- [`TelegramProvider` reference](https://mastra.ai/reference/channels/telegram-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/channels/telegram/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
