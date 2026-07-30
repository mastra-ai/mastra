---
'@mastra/platform-workspace': minor
---

Improved `PlatformSandbox.executeCommand`: commands now always run over the faster direct WebSocket connection. A single connection hiccup is retried once with a fresh lease instead of permanently downgrading the sandbox to the slower HTTP route. If the retry also fails, the call throws a typed error you can act on.

**New error types** exported from `@mastra/platform-workspace`:

- `SandboxDestroyedError` — thrown when the sandbox has been destroyed. The cached sandbox id and lease are cleared, so reusing the same instance will provision a fresh sandbox on the next call. Catch this to reprovision and retry.
- `SandboxExecTransportError` — thrown when the connection fails twice in a row against a sandbox that is still alive. Carries `sandboxId`, `command`, `attempts`, and connection diagnostics (`opened`, `closeCode`, `closeReason`, `wsEndpoint`) so you can tell a broken connection apart from a failed command.

**Behaviour changes callers should audit:**

- `PlatformApiError` (status 404 / 500 / 501 when starting an exec) now bubbles out of `executeCommand` instead of being silently retried against the old HTTP route. Wrap calls that expect to survive platform errors accordingly.
- A one-off connection failure no longer slows down the rest of the session. Later commands keep using the fast path.

```ts
import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

try {
  await sandbox.executeCommand('pytest');
} catch (err) {
  if (err instanceof SandboxDestroyedError) {
    // Reprovision the sandbox and replay the command.
  } else if (err instanceof SandboxExecTransportError) {
    console.error('Sandbox connection failed', {
      closeCode: err.closeCode,
      closeReason: err.closeReason,
      wsEndpoint: err.wsEndpoint,
    });
  }
}
```
