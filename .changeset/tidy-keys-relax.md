---
'@mastra/factory': patch
---

Made secret encryption opt-in instead of mandatory when auth is enabled. `MastraFactory.prepare()` no longer throws when `secretEncryption` is omitted with auth on; it logs a boot-time warning and falls back to plaintext credential storage. Providing `secretEncryption` (for example via `FACTORY_CREDENTIAL_ENCRYPTION_KEY`) remains the recommended configuration for encrypting stored model-provider keys, custom-provider API keys, and integration secrets at rest.
