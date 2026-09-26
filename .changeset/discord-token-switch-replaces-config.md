---
'@mastra/discord': patch
---

Switching the Discord bot token via `configure()` now replaces the app config instead of merging into it. Previously the prior application's `publicKey` and `applicationId` survived the switch — including in persisted config — so the old application's Ed25519 key kept verifying inbound webhooks while the new bot token was active. The provider now drops everything derived from the old token and re-resolves the new application's identity from `GET /applications/@me`.

For the same reason, `publicKey` and `applicationId` no longer fall back to `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` when the bot token is supplied via config or `configure()` — stale environment values from a different application would otherwise attach to the new token. Environment fallback for those fields applies only when the bot token itself comes from `DISCORD_BOT_TOKEN`.
