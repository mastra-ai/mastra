# @mastra/discord

## 1.1.0

### Minor Changes

- Added `@mastra/discord` for connecting Mastra agents to Discord. One Discord app serves many servers, and agents respond to slash commands, DMs, and @mentions. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt the stored bot token at rest. ([#25002](https://github.com/mastra-ai/mastra/pull/25002))

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

  // Bind an agent. If the bot is already in DISCORD_GUILD_ID, this binds the
  // agent to that guild and registers its slash commands immediately. Otherwise
  // it returns an OAuth2 bot-invite URL and the install stays pending until the
  // bot joins a guild — the first interaction from that guild activates it.
  const result = await discord.connect('support', { guildId: process.env.DISCORD_GUILD_ID });
  // → { type: 'immediate' }  OR  { type: 'oauth', authorizationUrl, installationId }
  ```

### Patch Changes

- Updated dependencies [[`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`b757896`](https://github.com/mastra-ai/mastra/commit/b757896872edd74f71ec104be92273c5406265da), [`7f64865`](https://github.com/mastra-ai/mastra/commit/7f648656d2b24b214a899e8835b8286333c80a19), [`f751e65`](https://github.com/mastra-ai/mastra/commit/f751e659f496e5e53ed38632c59c296fec2ccbe5)]:
  - @mastra/core@1.71.0

## 1.1.0-alpha.0

### Minor Changes

- Added `@mastra/discord` for connecting Mastra agents to Discord. One Discord app serves many servers, and agents respond to slash commands, DMs, and @mentions. Set `encryptionKey` or `MASTRA_ENCRYPTION_KEY` to encrypt the stored bot token at rest. ([#25002](https://github.com/mastra-ai/mastra/pull/25002))

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

  // Bind an agent. If the bot is already in DISCORD_GUILD_ID, this binds the
  // agent to that guild and registers its slash commands immediately. Otherwise
  // it returns an OAuth2 bot-invite URL and the install stays pending until the
  // bot joins a guild — the first interaction from that guild activates it.
  const result = await discord.connect('support', { guildId: process.env.DISCORD_GUILD_ID });
  // → { type: 'immediate' }  OR  { type: 'oauth', authorizationUrl, installationId }
  ```

### Patch Changes

- Updated dependencies [[`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1)]:
  - @mastra/core@1.71.0-alpha.1
