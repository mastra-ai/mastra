---
'@mastra/e2b': minor
---

Added `E2BFactorySandbox`, which plugs E2B into Mastra Factory as the sandbox provider. Factory gets one sandbox per session, a repository template it can build ahead of the first session, and user-tunable settings.

```ts
import { E2BFactorySandbox } from '@mastra/e2b';

new MastraFactory({
  sandbox: new E2BFactorySandbox(), // reads E2B_API_KEY
});
```

**Settings:** `cpuCount`, `memoryMb` and `idleTimeoutMinutes`. Unset values fall back to the `defaults` option, then to 2 CPUs, 1024 MB and 5 minutes.

**Builds:** starts a template build in the background, reports its status with logs, and lists the template's build history.
