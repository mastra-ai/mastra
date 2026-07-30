---
'@mastra/platform-workspace': minor
---

Removed the `/exec` proxy fallback from `PlatformSandbox.executeCommand` so direct-exec (WebSocket to Railway) is now the only data plane. A single WebSocket handshake hiccup no longer permanently disables direct-exec for the sandbox's lifetime — the client now performs one in-flight retry with a fresh lease, and only escalates to a typed error when the retry also fails.

**New error types** exported from `@mastra/platform-workspace`:

- `SandboxDestroyedError` — thrown when `/exec-lease` returns 410. The sandbox has been destroyed; the client clears its cached sandbox id and lease so a reused instance re-provisions on the next call. Fleet-level code should catch this and reprovision + replay.
- `SandboxExecTransportError` — thrown when both the initial WebSocket attempt and the retry close without an `exit` frame against a live sandbox. Carries `{ opened, closeCode, closeReason, wsEndpoint, sandboxId, command, attempts }` so operators can distinguish transport failures from command failures.

**Behaviour changes callers should audit:**

- `PlatformApiError` (status 404 / 500 / 501 on `/exec-lease`) now bubbles out of `executeCommand` instead of being silently swallowed by a fallback to `POST /sandbox/:id/exec`.
- A transient WebSocket transport failure no longer disables direct-exec for the sandbox's lifetime — subsequent execs use direct-exec again, protecting per-session performance under the concurrent-exec burst patterns the fallback used to permanently punish.

```ts
import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

try {
  await sandbox.executeCommand('pytest');
} catch (err) {
  if (err instanceof SandboxDestroyedError) {
    // fleet layer: clear stale binding, reprovision, replay
  } else if (err instanceof SandboxExecTransportError) {
    console.error('Railway data plane failure', {
      closeCode: err.closeCode,
      closeReason: err.closeReason,
      wsEndpoint: err.wsEndpoint,
    });
  }
}
```
