---
'@mastra/platform-workspace': minor
'@mastra/factory': patch
---

Kept real GitHub tokens out of credential-vault sandboxes. `PlatformSandbox` now exposes a `vault` field set from the platform's provision and reattach responses (`undefined` when the platform did not report it). When a sandbox runs in vault mode, or its mode is unknown, Factory installs no `GH_TOKEN`, configures no git credential helper, and passes no per-command git or `gh` credentials. The platform's placeholder token stays in place and the vault adds the real credential. In those sandboxes `github_refresh_token` explains why there is no token to refresh and does not mint one.

`PlatformSandbox.refreshVault()` reads the sandbox's mode from `GET /sandbox/:id`. A recovery-id reattach that does not report its mode calls it automatically, and Factory calls it again on start and on `github_refresh_token` while the mode is unknown.
