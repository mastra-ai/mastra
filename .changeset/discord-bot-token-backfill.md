---
'@mastra/discord': minor
---

A bot token is now enough to configure `DiscordProvider` — `applicationId` and `publicKey` are resolved automatically from Discord's `GET /applications/@me` when omitted, then persisted alongside the token.

```typescript
// Before: all three credentials were required
new DiscordProvider({ app: { botToken, publicKey, applicationId } });

// After: the bot token alone works
new DiscordProvider({ app: { botToken } });
```

Explicitly supplied values (config, `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` env vars, or `configure()`) still take precedence over the resolved ones.
