---
'@mastra/connect': minor
---

The Discord channel in `channels()` now matches the platform's `discord-bot` integration and reads the bot token from the connection's credentials endpoint instead of connection metadata.

**Why:** connection metadata is treated as non-secret by the platform, so a bot token stored there was readable by any caller with project access. The `discord-bot` integration stores each user's own bot token as an API-key credential on the platform's encrypted secrets path.

**Before:** an OAuth `discord` connection with a shared `botToken` in its metadata activated the channel.

**After:** connect a `discord-bot` connection (paste your bot token from the Discord Developer Portal). Per-integration overrides move from `integrations.discord` to `integrations['discord-bot']`:

```ts
const resolver = await channels({
  projectId,
  integrations: {
    'discord-bot': { providerOptions: { commandScope: 'global' } },
  },
});
const providers = await resolver(); // providers['discord-bot']
```

Connections whose credential is not an API key are skipped with a warning, since Discord rejects OAuth user tokens for bot authentication.
