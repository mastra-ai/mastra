---
'@mastra/platform-workspace': minor
---

Added trusted Vault mode discovery to PlatformSandbox. Factory sandboxes forward their session owner as the acting user and omit GitHub credentials when Platform reports Vault mode. Mode discovery failures do not fall back to token access.

```ts
await sandbox.start();
const vault = sandbox.vault ?? (await sandbox.refreshVault());
if (vault === false) {
  // Token-mode sandbox: GitHub credentials may be installed.
} else {
  // Vault or unresolved mode: do not install GitHub credentials.
}
```
