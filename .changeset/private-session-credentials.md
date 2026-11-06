---
'@mastra/factory': patch
---

Added private credential handoff for integration tests. An agent can ask for a credential with `factory_request_credential`, which returns a one-time link (15 minutes, session owner only) to a signed-in Factory form. The value is sent only in that form's POST body, stored encrypted per session with an expiry (1–24 hours) and can be revoked. The agent is told only the credential's name, and can pass it to a single sandbox command as an environment variable with `factory_run_with_credentials`.

Use short-lived, least-privilege test credentials only: code running in the sandbox can read the value, and output redaction is best-effort. Credential entry is disabled when auth is on but `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is not set.
