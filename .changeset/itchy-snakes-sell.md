---
'@mastra/platform-workspace': minor
---

`PlatformSandbox.executeCommand` can now dial the sandbox directly over Railway's private network instead of going through the platform's public exec proxy. On paths where the direct route is available, per-exec latency drops from ~400 ms p50 to ~16 ms p50, and the exec stops touching the platform control plane. This flows through to every filesystem call (`SandboxFilesystem.readFile`, `writeFile`, `readdir`, `mkdir`, `stat`, `exists`, `copyFile`, `moveFile`, `deleteFile`), which is where most agent tool time was going.

Direct-path availability is a runtime property, not a configuration knob. When it's not available — no address registry wired up, the workspace-proxy hasn't discovered the sandbox address yet, or a direct dial fails — `executeCommand` transparently falls back to the existing exec-lease path with no behavior change. Timed-out execs are never retried on the fallback path (they're returned to the caller as-is), so this is safe for non-idempotent commands.

### Enabling the direct path

Wire a `SandboxAddressRegistry` into `PlatformSandbox`:

```ts
import { PlatformSandbox, InProcessSandboxAddressRegistry } from '@mastra/platform-workspace';

const registry = new InProcessSandboxAddressRegistry();

const sandbox = new PlatformSandbox({
  accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
  projectId: process.env.MASTRA_PLATFORM_PROJECT_ID,
  environmentId: process.env.MASTRA_PLATFORM_ENVIRONMENT_ID,
  addressRegistry: registry,
});
```

`PlatformSandbox.start()` populates the registry from the workspace-proxy's response; `executeCommand` reads it, tries the direct path first, evicts on transport failure. `destroy()` also evicts. `clone()` shares the same registry — each child sandbox looks up its own id.

### New public exports

- `SandboxAddressRegistry` — the `{ get, set, delete }` interface `PlatformSandbox` sees. Callers can implement their own (e.g. shared across a worker pool) or use the default.
- `InProcessSandboxAddressRegistry` — the default `Map`-backed implementation.
- `PlatformSandboxOptions.addressRegistry?` — DI seam. Optional; omitted keeps pre-existing behavior.
- `execViaPrivateNetwork`, `PrivateNetExecHttpError`, `PrivateNetExecOptions`, `PrivateNetExecResult`, `PrivateNetFetch` — standalone transport for callers that want to talk to a sandbox directly without going through `PlatformSandbox`.
