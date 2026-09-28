---
'@mastra/connect': minor
---

Discord (channel **and** generated tools) now targets the platform's `discord-dual` integration — an API-key connection whose credential is the per-user bot token, sourced from the encrypted `/credentials` endpoint on every call. `discord-dual` is the platform-catalog rename over Nango's upstream `discord-bot` provider; the single connection powers both the channel and the tools from one credential.

**Why:** connection metadata is treated as non-secret by the platform, so a bot token stored there was readable by any caller with project access. Every Discord surface now reads the bot token from the platform's encrypted, audited credentials path.

**Breaking:**

- The 33 generated Discord tools no longer read the bot token from connection metadata; they call `getConnectionWithCredentials()` and use `credentials.apiKey`.
- The `providers/discord/` folder is renamed to `providers/discord-dual/`; `discordProvider` is renamed to `discordDualProvider`; `createDiscordTools` is renamed to `createDiscordDualTools`; the `PROVIDERS` integrationId changes from `discord` to `discord-dual`; the connection-id env var changes from `MASTRA_DISCORD_CONNECTION_ID` to `MASTRA_DISCORD_DUAL_CONNECTION_ID`.
- The channel resolver's map key is `discord-dual`; per-integration overrides use `integrations['discord-dual']`.

```ts
import { createDiscordDualTools } from '@mastra/connect';

const tools = createDiscordDualTools({ connectionId: 'conn_...' });

const resolver = await channels({
  projectId,
  integrations: {
    'discord-dual': { providerOptions: { commandScope: 'global' } },
  },
});
const providers = await resolver(); // providers['discord-dual']
```

Channel connections whose credential is not an API key are skipped with a warning, since Discord rejects OAuth user tokens for bot authentication.
