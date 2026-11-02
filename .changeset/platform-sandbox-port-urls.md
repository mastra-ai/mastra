---
'@mastra/platform-workspace': minor
---

Added port URLs to `PlatformSandbox`. `sandbox.networking.getPortUrl(port)` returns the URL of a port in the running sandbox, such as a dev server, so you can open it in a browser. Ports are private: anyone in the sandbox's organization can open the URL after signing in to Mastra.

```typescript
await sandbox.processes.spawn('pnpm dev --host 0.0.0.0 --port 3000')
const url = await sandbox.networking.getPortUrl(3000)
```
