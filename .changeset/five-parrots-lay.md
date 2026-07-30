---
'@mastra/platform-workspace': minor
---

Fixed `PlatformSandbox.executeCommand` permanently falling back to the slower HTTP `/exec` route after a single WebSocket hiccup. A dropped connection is now retried once with a fresh lease, and later commands keep using the direct WebSocket path.

The HTTP fallback has been removed. Errors from the exec-lease endpoint now surface directly instead of being swallowed:

- A 410 response throws the new `SandboxDestroyedError`. The cached sandbox id and lease are cleared, so the next call provisions a fresh sandbox.
- Any other non-2xx response throws `PlatformApiError` (previously masked by the fallback).
- Two connection failures in a row against a live sandbox throw the new `SandboxExecTransportError`, which carries `sandboxId`, `command`, `attempts`, `opened`, `closeCode`, `closeReason`, and `wsEndpoint` for diagnostics.

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
