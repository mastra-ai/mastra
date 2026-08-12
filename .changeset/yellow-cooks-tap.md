---
'@mastra/deployer-sandbox': minor
---

Added fail-closed hard resource limits for sandbox workers.

Workers can now opt into per-attempt CPU time, address-space, file-size, and open-file limits:

```ts
await deployWorkerToSandbox({
  // ...
  resourceLimits: {
    cpuTimeSeconds: 30,
    addressSpaceBytes: 536_870_912,
    fileSizeBytes: 10_485_760,
    openFiles: 256,
  },
});
```

Requested limits are capability-checked before deployment. CPU and file-size signal exhaustion is reported through the typed `resource_exhausted` status.
