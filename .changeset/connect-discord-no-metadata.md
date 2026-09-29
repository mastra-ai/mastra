---
'@mastra/connect': patch
---

Discord channel connections no longer require `applicationId` and `publicKey` on the platform connection. The bot token stored as the connection credential is enough — the provider resolves the rest from Discord automatically — so the "missing applicationId + publicKey" warning is gone. Connection metadata and `providerOptions` still work as explicit overrides.
