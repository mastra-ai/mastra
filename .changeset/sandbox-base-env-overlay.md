---
'@mastra/core': minor
---

Sandboxes now own their runtime environment. `MastraSandbox` accepts an `env` constructor option, and you can read or update the environment at runtime with `getEnv()` and `setEnv(updater)`:

```typescript
sandbox.setEnv(env => ({ ...env, GH_TOKEN: token }));
```

The sandbox environment is merged into every process spawn by the base `SandboxProcessManager`, so it reaches `executeCommand()` and `processes.spawn()` on any provider whose execution routes through its process manager, including values installed or rotated after the sandbox was created (for example, refreshed credentials). Per-call `env` options take precedence for that command only.

These values apply to commands executed through the sandbox; they are not VM-level environment and are never written into the VM. `WorkspaceSandbox` declares `setEnv` as an optional capability.
