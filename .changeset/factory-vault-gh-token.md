---
'@mastra/platform-workspace': minor
'@mastra/factory': patch
---

Kept real GitHub tokens out of credential-vault sandboxes. `PlatformSandbox` now exposes a `vault` field set from the platform's provision, reattach and `GET /sandbox/:id` responses: `true` when the platform reports vault mode, `false` when a response omits it. When a sandbox runs in vault mode, Factory installs no `GH_TOKEN`, configures no git credential helper, and passes no per-command git or `gh` credentials. The platform's placeholder token stays in place and the vault adds the real credential. In those sandboxes `github_refresh_token` explains why there is no token to refresh and does not mint one.

`PlatformSandbox.refreshVault()` reads the sandbox's mode from `GET /sandbox/:id`. A reattach by recovery id calls it before the start completes, and a failed read fails the start rather than falling back to handing out tokens.

Vault sandboxes need a workspace proxy that reports `vault: true` on reattach and `GET /sandbox/:id` as well as on provision.
