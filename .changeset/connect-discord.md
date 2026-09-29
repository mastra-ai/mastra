---
'@mastra/connect': minor
---

Discord (channel **and** generated tools) now targets the platform's `discord` integration as a **single API-key connection** whose credential is the bot token, sourced from the encrypted `/credentials` endpoint on every call. The same connection powers both the channel and every generated tool from one credential.

**Why:** connection metadata is treated as non-secret by the platform, so a bot token stored there was readable by any caller with project access. Every Discord surface now reads the bot token from the platform's encrypted, audited credentials path.

**Breaking:**

- The 33 generated Discord tools no longer read the bot token from connection metadata; they call `getConnectionWithCredentials()` and use `credentials.apiKey`.
- The `discord` integration on the platform is now API-key auth (Nango's `discord-bot` provider), not OAuth. OAuth-typed credentials on the channel are skipped with a warning — Discord rejects OAuth user tokens for bot authentication.

**Migration:**

1. Reconnect the `discord` integration on the platform against the new API-key auth flow (Nango's `discord-bot`) and paste the bot token when prompted. The token is now stored in the encrypted credential, not connection metadata.
2. Remove any `botToken` you were still writing to connection metadata — it is no longer read and, since metadata is non-secret, it should not be left behind.

Before:

```ts
// Bot token was pulled from non-secret connection metadata.
// Tools called `getMetadata<{ botToken: string }>()` internally.
```

After:

```ts
import { channels, tools } from '@mastra/connect';

const projectId = 'proj_...';

// Generated Discord tools — bot token now comes from the encrypted
// `credentials.apiKey` on the `discord` connection.
const toolResolver = tools({
  projectId,
  integrations: { discord: { connectionId: 'conn_...' } },
});
const discordTools = await toolResolver();

// Discord channel — same `discord` connection, same credential.
const channelResolver = await channels({
  projectId,
  integrations: {
    discord: { providerOptions: { commandScope: 'global' } },
  },
});
const providers = await channelResolver(); // providers.discord
```
