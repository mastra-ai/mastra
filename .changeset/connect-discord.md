---
'@mastra/connect': minor
---

Discord (channel **and** generated tools) now targets the platform's `discord` integration as a **single API-key connection** whose credential is the bot token, sourced from the encrypted `/credentials` endpoint on every call. The same connection powers both the channel and every generated tool from one credential.

**Why:** connection metadata is treated as non-secret by the platform, so a bot token stored there was readable by any caller with project access. Every Discord surface now reads the bot token from the platform's encrypted, audited credentials path.

**Breaking:**

- The 33 generated Discord tools no longer read the bot token from connection metadata; they call `getConnectionWithCredentials()` and use `credentials.apiKey`.
- The `discord` integration on the platform is now API-key auth (Nango's `discord-bot` provider), not OAuth. OAuth-typed credentials on the channel are skipped with a warning — Discord rejects OAuth user tokens for bot authentication.

```ts
import { createDiscordTools } from '@mastra/connect';

const tools = createDiscordTools({ connectionId: 'conn_...' });

const resolver = await channels({
  projectId,
  integrations: {
    discord: { providerOptions: { commandScope: 'global' } },
  },
});
const providers = await resolver(); // providers.discord
```
