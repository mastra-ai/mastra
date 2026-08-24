---
'@mastra/core': minor
---

Sandboxes now own a runtime environment overlay. `MastraSandbox` accepts an `env` constructor option and exposes `setEnv(updater)` to update the overlay at runtime:

```typescript
sandbox.setEnv(env => ({ ...env, GH_TOKEN: token }));
```

Overlay values are merged into every process spawn by the base `SandboxProcessManager`, so they reach `executeCommand()` and `processes.spawn()` on any provider whose execution routes through its process manager, including values installed or rotated after the sandbox was created (for example, refreshed credentials). Per-call `env` options take precedence over the overlay.

The overlay is visible to commands executed through the sandbox; it is not VM-level environment and is never written into the VM. `WorkspaceSandbox` declares `setEnv` as an optional capability.
