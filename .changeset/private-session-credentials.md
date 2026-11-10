---
'@mastra/factory': patch
---

Added private credential handoff for integration tests. An agent can ask for a credential with `factory_request_credential`, which returns a one-time link (15 minutes, current session owner only) to a signed-in Factory form. The value is sent only in that form's POST body, stored encrypted per session with an expiry (1–24 hours), and can be revoked. Credentials are deleted when the session is retired or deleted, and expired ones are swept. The agent is told only the credential's name, and can pass it to a single sandbox command as an environment variable with `factory_run_with_credentials`.

**Security trade-off:** sandbox use is opt-in per credential and off by default. Once opted in, any code running in the sandbox while the command runs (agent commands, repository or dependency scripts, prompt-injected commands) can read the value and send it elsewhere. Output redaction only catches the literal, base64 and URL-encoded forms and is best-effort. There is no brokered (server-side) path yet, so a credential saved without sandbox use cannot be used. Use short-lived, least-privilege test credentials only.

Credential entry is disabled when auth is on but `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is not set.
