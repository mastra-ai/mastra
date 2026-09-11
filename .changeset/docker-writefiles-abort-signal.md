---
'@mastra/docker': minor
---

Added cancellation support to `DockerSandbox.writeFiles`. Pass an `AbortSignal` to stop uploading files to a container mid-transfer.

**Cancelling a file upload**

```ts
const controller = new AbortController();

// Cancel from elsewhere (e.g. a timeout or user action)
setTimeout(() => controller.abort(), 1000);

try {
  await sandbox.writeFiles(files, { abortSignal: controller.signal });
} catch (error) {
  if (error.code === 'ABORTED') {
    // Upload was cancelled
  }
}
```

If the signal is already aborted, the upload rejects before any work begins. If it aborts during transfer, the in-flight upload to the Docker daemon is terminated. Cancellation rejects with a `SandboxAbortError` (code `ABORTED`). Cancellation does not roll back files that were already written, so dispose of or clean up the sandbox if you need a clean state.
