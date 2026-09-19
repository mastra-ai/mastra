---
'@mastra/docker': minor
---

Added AbortSignal cancellation for Docker template builds, repository template resolution, and lazy sandbox starts. Cancelling startup stops local template-preparation streams and sessions, rejects with `SandboxAbortError` while preserving the signal's custom reason as the error cause, and leaves the template retryable.

```typescript
const controller = new AbortController();
const start = sandbox.start({ abortSignal: controller.signal });
controller.abort(new Error('request cancelled'));
await start;

await template.build({ abortSignal: controller.signal });
```
