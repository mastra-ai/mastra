---
"@mastra/docker": minor
---

You can now secure and limit Docker sandbox containers with memory, CPU quota/period, PID, capability add/drop, security options, ulimits, read-only root filesystem, and tmpfs options.

```typescript
const sandbox = new DockerSandbox({
  memory: 512 * 1024 * 1024,
  memorySwap: 512 * 1024 * 1024,
  cpuQuota: 100_000,
  pidsLimit: 256,
  readonlyRootfs: true,
  capDrop: ['ALL'],
  securityOpt: ['no-new-privileges:true'],
})
```
