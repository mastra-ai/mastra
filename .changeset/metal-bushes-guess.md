---
'@mastra/docker': minor
---

Added AbortSignal cancellation for Docker template builds, repository template resolution, and lazy sandbox starts.

```typescript
const controller = new AbortController();
await sandbox.start({ abortSignal: controller.signal });
await template.build({ abortSignal: controller.signal });
```
