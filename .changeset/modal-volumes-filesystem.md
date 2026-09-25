---
'@mastra/modal': minor
---

Added Modal Volume mounts and a volume-backed workspace filesystem.

- New `volumes` option on `ModalSandbox` mounts Modal Volumes at the given paths.
- New `sandbox.reloadVolumes()` picks up writes made to a Volume by other sandboxes.
- New `ModalFilesystem` exposes a path inside the sandbox (such as a Volume mount) to workspace file tools, so agent files persist across sandbox restarts.

```typescript
const sandbox = new ModalSandbox({ workingDirectory: '/workspace', volumes: { '/mnt/agent': volume } })
const workspace = new Workspace({
  sandbox,
  filesystem: new ModalFilesystem({ sandbox, basePath: '/mnt/agent' }),
})
```
