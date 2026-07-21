---
'@mastra/core': minor
---

Added an optional `networking` capability and `writeFiles()` method to the `WorkspaceSandbox` interface. Sandbox providers that expose public port URLs can now implement `networking.getPortUrl(port)`, which enables preview URLs and sandbox deploys (see the new `@mastra/deployer-sandbox` package). Use the new `supportsNetworking()` type guard to detect the capability at runtime.

```typescript
import { supportsNetworking } from '@mastra/core/workspace';

if (supportsNetworking(sandbox)) {
  const url = await sandbox.networking.getPortUrl(4111);
}
```
