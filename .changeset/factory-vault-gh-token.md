---
'@mastra/core': patch
'@mastra/platform-workspace': minor
'@mastra/factory': patch
---

Kept real GitHub tokens out of credential-vault sandboxes. `PlatformSandbox` now exposes a `vault` field set from the platform's provision, reattach and `GET /sandbox/:id` responses: `true` when the platform reports vault mode, `false` when a response omits it. When a sandbox runs in vault mode, Factory installs no `GH_TOKEN`, configures no git credential helper, and passes no per-command git or `gh` credentials. The platform's placeholder token stays in place and the vault adds the real credential. In those sandboxes `github_refresh_token` explains why there is no token to refresh and does not mint one.

`PlatformSandbox.refreshVault()` reads the sandbox's mode from `GET /sandbox/:id`. A reattach by recovery id calls it before the start completes. Network errors, 429 and 5xx responses are retried with backoff; if every retry fails, the start fails and the next start asks again. A failed read never falls back to handing out tokens.

```ts
await sandbox.start();
// undefined until the platform has answered; refreshVault() asks it and throws if it cannot
const vault = sandbox.vault ?? (await sandbox.refreshVault());
if (vault === false) {
  // token mode: safe to install a GitHub token
} else if (vault === true) {
  // vault mode: install no token, the vault adds the credential
} else {
  // still unknown (no sandbox attached, or it changed during the read): install nothing yet
}
```

`FactorySandboxContext` gains an optional `userId`, the session owner. Factory sets it on every session sandbox, and `PlatformFactorySandbox` sends it as the acting user (`x-acting-user-id`) on every workspace-proxy request, which the proxy requires to create and run a vault sandbox. Sandboxes without an owner send no acting user, as before.

A vault sandbox carries its owner's GitHub credential, so only the session owner can open it. Other members of the organization are refused an org-visible vault session, both when they would create its sandbox and when they would reuse the one the owner already opened. A session whose mode can't be read is refused too. Token-mode sessions stay open to the organization. That refusal also covers a custom sandbox callback and any provider factory does not ship itself: only `local`, `docker`, and `e2b` are treated as unable to attach a credential vault. An admin can still start those offline.

Taking over a session releases the previous owner's vault sandbox: it is destroyed and its id cleared, so the new owner's next start provisions a sandbox with their own vault. If it can't be released, ownership doesn't change. A sandbox the platform confirms is token mode is kept. Each sandbox stays bound to the user it was built for, so the new owner can't use the previous owner's vault sandbox while the takeover is still releasing it.

When sandbox create fails because the owner hasn't enabled the vault (`PlatformApiError` code `vault_not_enabled`), the Slack run-error card explains it and shows an **Enable vault** button that links to the URL in the platform's message.

Vault sandboxes need a workspace proxy that reports `vault: true` on reattach and `GET /sandbox/:id` as well as on provision.
