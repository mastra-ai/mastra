---
'@mastra/docker': minor
---

Added AbortSignal cancellation for Docker template builds, repository template resolution, and lazy sandbox starts. Cancelling startup stops local template-preparation streams and sessions, rejects with `SandboxAbortError` while preserving the signal's custom reason as the error cause, and leaves the template retryable.

```typescript
const startController = new AbortController();
const start = sandbox.start({ abortSignal: startController.signal });
startController.abort(new Error('request cancelled'));
try {
  await start;
} catch (error) {
  if (!(error instanceof SandboxAbortError)) throw error;
}

const buildController = new AbortController();
const build = template.build({ abortSignal: buildController.signal });
buildController.abort(new Error('request cancelled'));
try {
  await build;
} catch (error) {
  if (!(error instanceof SandboxAbortError)) throw error;
}
```
