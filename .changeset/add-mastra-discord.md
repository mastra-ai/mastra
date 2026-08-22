---
'@mastra/discord': minor
---

Added `@mastra/discord` for connecting Mastra agents to Discord. One Discord app serves many servers, and agents respond to slash commands, DMs, and @mentions. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt the stored bot token at rest.

```ts
import { Mastra } from '@mastra/core';
import { DiscordProvider } from '@mastra/discord';

// App credentials from the Discord Developer Portal (or the DISCORD_BOT_TOKEN /
// DISCORD_PUBLIC_KEY / DISCORD_APPLICATION_ID env vars):
const discord = new DiscordProvider({
  app: {
    botToken: process.env.DISCORD_BOT_TOKEN!,
    publicKey: process.env.DISCORD_PUBLIC_KEY!,
    applicationId: process.env.DISCORD_APPLICATION_ID!,
  },
});

export const mastra = new Mastra({
  agents: { support },
  channels: { discord },
});

// Bind an agent to a guild — registers its slash commands:
const result = await discord.connect('support', { guildId: process.env.DISCORD_GUILD_ID });
```
