---
'@mastra/daytona': minor
---

Added networking and bulk file upload support to `DaytonaSandbox`:

- **Public port URLs**: `sandbox.networking.getPortUrl(port)` returns the preview URL for a port, enabling preview URLs and deploys with the new `@mastra/deployer-sandbox` package. Pass `public: true` for tokenless URLs.
- **Bulk file upload**: `sandbox.writeFiles(files)` uploads multiple files in one call via the SDK's native `fs.uploadFiles()`.
- **Detached lifecycle**: `getPortUrl()`, `stop()`, and `destroy()` now work from a fresh process by looking up the existing sandbox by its `id`, without starting a stopped sandbox first.

```typescript
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({ id: 'my-preview', public: true });
await sandbox.start();
const url = await sandbox.networking.getPortUrl(4111);
```
