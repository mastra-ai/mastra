---
'@mastra/railway': minor
'@mastra/platform-workspace': minor
'@mastra/e2b': minor
---

Added a `reattach` option to `RailwaySandbox`, `PlatformSandbox`, and `E2BSandbox` to control what happens when a persisted `sandboxId` can't be reattached on `start()`.

- `'best-effort'` (default, unchanged behavior): provision a replacement sandbox.
- `'required'`: throw a `SandboxError` with code `SANDBOX_REATTACH_FAILED` instead, so the caller can tell the user their previous VM (and its state) is gone rather than silently starting a fresh one.

Transient errors such as auth, rate limit, or network failures still propagate unchanged. Clones inherit the parent's `reattach` setting.

```ts
const sandbox = new RailwaySandbox({ sandboxId: session.sandboxId, reattach: 'required' });

try {
  await sandbox.start();
} catch (error) {
  if (error instanceof SandboxError && error.code === 'SANDBOX_REATTACH_FAILED') {
    // Previous VM is gone: ask the user to start fresh, then clear the persisted sandboxId.
  }
}
```
