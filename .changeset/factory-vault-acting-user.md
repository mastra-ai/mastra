---
'@mastra/platform-workspace': patch
---

Credential-vault sandboxes now act only for a person who enabled the vault. `PlatformFactorySandbox` no longer sends Factory's rule dispatcher as the acting user, so rule-dispatched sessions, like sessions without an owner, cannot start a vault sandbox.

When the platform refuses a vault-mode create, `PlatformSandbox` throws a `SandboxError` that says what to do instead of a raw API error, without retrying:

- `SANDBOX_VAULT_NOT_ENABLED`: the session owner has not enabled the vault for the organization. The message includes the enable link.
- `SANDBOX_VAULT_USER_NOT_MEMBER`: the session owner is no longer a member of the organization.
- `SANDBOX_VAULT_USER_REQUIRED`: the session has no owner, or was started by a rule.

The enable link defaults to `<MASTRA_SHARED_API_URL>/auth/vault/enable` (`https://platform.mastra.ai/v1/auth/vault/enable` when unset). Set `vaultEnableUrl` on `PlatformSandbox` to override it.
