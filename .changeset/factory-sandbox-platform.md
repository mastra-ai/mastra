---
'@mastra/platform-workspace': minor
---

Added `PlatformFactorySandbox`, which plugs Mastra Platform sandboxes into Mastra Factory as the sandbox provider. Factory gets one sandbox per session, a repository template it can build ahead of the first session, and user-tunable settings. It takes the same options as `PlatformSandbox` except the per-session ones (`id`, `sandboxId`, `sessionId`, `template`).

```ts
import { MastraFactory } from '@mastra/factory';
import { PlatformFactorySandbox } from '@mastra/platform-workspace';

new MastraFactory({
  sandbox: new PlatformFactorySandbox(), // reads MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_ENVIRONMENT_ID
});
```

**Settings:** `cpuCount`, `memoryMb` and `idleTimeoutMinutes`. Unset values fall back to the `defaults` option, then to 2 CPUs, 1024 MB and 5 minutes.

**Builds:** starts a template build through the platform build API and reports its status.
