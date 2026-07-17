---
'@mastra/e2b': minor
---

Added networking and bulk file upload support to `E2BSandbox`:

- **Public port URLs**: `sandbox.networking.getPortUrl(port)` returns the public URL for a port, enabling preview URLs and deploys with the new `@mastra/deployer-sandbox` package.
- **Bulk file upload**: `sandbox.writeFiles(files)` uploads multiple files in one call.
- **Snapshot-stop**: `stop()` now pauses the sandbox immediately (snapshotting filesystem, memory, and running processes) instead of leaving it running until its timeout. The next `start()` with the same `id` resumes it, with background processes still running. `destroy()` still kills the sandbox permanently.
- **Detached lifecycle**: `getPortUrl()`, `stop()`, and `destroy()` now work from a fresh process by looking up the existing sandbox by its `id` metadata, without resuming a paused sandbox. Stopping or destroying never wakes (or bills) a paused sandbox first.

```typescript
import { E2BSandbox } from '@mastra/e2b';

const sandbox = new E2BSandbox();
await sandbox.start();
const url = await sandbox.networking.getPortUrl(4111);
```
