---
'@mastra/platform-workspace': minor
---

Added `publicPorts` to `PlatformSandbox`. Sandbox ports are private by default and open through a signed-in preview link. Set `publicPorts: true` to let anyone with a port's URL reach it, for example a webhook receiver:

```typescript
const sandbox = new PlatformSandbox({ publicPorts: true })
```

Only E2B sandboxes support this, and it's fixed when the sandbox is created.
