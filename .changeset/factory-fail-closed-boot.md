---
'create-factory': minor
---

Production Factory servers no longer start with unsafe fallbacks when security configuration is missing. Outside development and tests, the server now refuses to boot when:

- `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is unset. Model-provider keys, custom-provider API keys, and integration secrets would otherwise be stored in plaintext. Set `FACTORY_CREDENTIAL_ENCRYPTION=plaintext` to opt into unencrypted storage.
- No Mastra platform or E2B sandbox credentials are configured. Agent commands would otherwise run directly on the host with no isolation. Set `FACTORY_SANDBOX_PROVIDER=local` to opt into host execution.
