---
"@mastra/docker": minor
---

Docker sandbox containers now support resource limits and security hardening through Docker HostConfig options. Configure memory, CPU quota, process IDs, capabilities, security options, read-only root filesystems, and tmpfs mounts.

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
