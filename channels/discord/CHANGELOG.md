# @mastra/discord

## 1.2.0-alpha.0

### Minor Changes

- A bot token is now enough to configure `DiscordProvider` — `applicationId` and `publicKey` are resolved automatically from Discord's `GET /applications/@me` when omitted, then persisted alongside the token. ([#25125](https://github.com/mastra-ai/mastra/pull/25125))

  ```typescript
  // Before: all three credentials were required
  new DiscordProvider({ app: { botToken, publicKey, applicationId } });

  // After: the bot token alone works
  new DiscordProvider({ app: { botToken } });
  ```

  Explicitly supplied values (config, `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` env vars, or `configure()`) still take precedence over the resolved ones.

### Patch Changes

- Switching the Discord bot token via `configure()` now replaces the app config instead of merging into it. Previously the prior application's `publicKey` and `applicationId` survived the switch — including in persisted config — so the old application's Ed25519 key kept verifying inbound webhooks while the new bot token was active. The provider now drops everything derived from the old token and re-resolves the new application's identity from `GET /applications/@me`. ([#25149](https://github.com/mastra-ai/mastra/pull/25149))

  For the same reason, `publicKey` and `applicationId` no longer fall back to `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` when the bot token is supplied via config or `configure()` — stale environment values from a different application would otherwise attach to the new token. Environment fallback for those fields applies only when the bot token itself comes from `DISCORD_BOT_TOKEN`.

- Updated dependencies [[`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e)]:
  - @mastra/core@1.72.0-alpha.2

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
