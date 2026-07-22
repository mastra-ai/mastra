---
'@mastra/vercel': minor
---

Added networking and bulk file upload support to `VercelSandbox`:

- **Public port URLs**: `sandbox.networking.getPortUrl(port)` returns the public URL for a declared port, enabling preview URLs and deploys with the new `@mastra/deployer-sandbox` package.
- **Bulk file upload**: `sandbox.writeFiles(files)` uploads multiple files in one call using the Vercel Sandbox SDK.
- **Named sandbox resume**: when `sandboxName` is set, `start()` now reuses an existing sandbox with that name instead of always creating a new one. Stopping a named sandbox snapshots its filesystem, and the next `start()` resumes it.
- **Real destroy**: `destroy()` now permanently deletes the sandbox and its snapshots (previously it only stopped it). Use `stop()` for a resumable snapshot-stop.
- **Resume-less lookups**: `networking.getPortUrl()`, `stop()`, and `destroy()` on a named sandbox now attach to the existing sandbox with `resume: false` when the instance hasn't been started in the current process. Resolving a URL or tearing down a stopped sandbox never wakes it (and never starts billing).

```typescript
import { VercelSandbox } from '@mastra/vercel';

const sandbox = new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] });
await sandbox.start();
const url = await sandbox.networking.getPortUrl(4111);
```
