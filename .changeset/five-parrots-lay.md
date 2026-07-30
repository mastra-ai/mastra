---
'@mastra/platform-workspace': minor
---

`PlatformSandbox.executeCommand` now retries a dropped connection once and continues using direct execution for later commands. Previously a single connection hiccup permanently downgraded the sandbox to a slower fallback route for the rest of its lifetime.

Execution failures now surface directly:

- A destroyed sandbox throws the new `SandboxDestroyedError`. The cached sandbox is cleared, so the next call provisions a fresh one.
- Two connection failures in a row against a live sandbox throw the new `SandboxExecTransportError`, which carries `sandboxId`, `command`, `attempts`, `opened`, `closeCode`, `closeReason`, and `wsEndpoint` for diagnostics.
- Other platform errors previously masked by the fallback now bubble out as `PlatformApiError`.

```ts
import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

try {
  await sandbox.executeCommand('pytest');
} catch (err) {
  if (err instanceof SandboxDestroyedError) {
    // Reprovision and retry.
  } else if (err instanceof SandboxExecTransportError) {
    // Connection failed twice; sandbox is still alive.
  }
}
```
