---
'@mastra/core': minor
---

Added an optional `abortSignal` to the `WorkspaceSandbox.writeFiles` contract so file uploads can be cancelled. Also added a `SandboxAbortError` (code `ABORTED`) that providers throw when a write is cancelled.

```ts
const controller = new AbortController();
await sandbox.writeFiles?.(files, { abortSignal: controller.signal });
```

Observing the signal is provider-dependent. Providers that do not support cancellation ignore the option and run to completion.
