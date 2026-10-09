---
'@mastra/platform-workspace': patch
---

Fixed `PlatformSandbox.getInfo()` asking the workspace proxy about a `sandboxId` hint before `start()` had confirmed it, which failed the first tool call of a resumed session with `404 not_found`. `getInfo()` now answers from local state until the sandbox has started in the current process.

Added a `sandboxId` property that exposes the platform's id for the running sandbox, so callers persist an id the proxy recognises and reattach to the same sandbox later:

```ts
const sandbox = new PlatformSandbox({ id: 'session-1', environmentId: 'env_123' });
await sandbox.start();
const persisted = sandbox.sandboxId; // the platform's id, undefined before start()

const resumed = new PlatformSandbox({ id: 'session-1', environmentId: 'env_123', sandboxId: persisted });
await resumed.start(); // { outcome: 'connected' }
```
