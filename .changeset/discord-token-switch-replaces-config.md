---
'@mastra/discord': patch
---

Switching the Discord bot token via `configure()` now replaces the app config instead of merging into it. Previously the prior application's `publicKey` and `applicationId` survived the switch — including in persisted config — so the old application's Ed25519 key kept verifying inbound webhooks while the new bot token was active. The provider now drops everything derived from the old token and re-resolves the new application's identity from `GET /applications/@me`.
