---
'@mastra/factory': minor
---

Added `FactorySandbox` support to `MastraFactoryConfig.sandbox`. Pass a provider instance (`PlatformFactorySandbox`, `E2BFactorySandbox`, `DockerFactorySandbox`, or the new `LocalFactorySandbox` exported from `@mastra/factory`) and the factory gains that provider's environment settings and template builds. The callback form still works and is wrapped as a `provider: 'custom'` sandbox with no settings.

```ts
import { MastraFactory, LocalFactorySandbox } from '@mastra/factory';
import { E2BFactorySandbox } from '@mastra/e2b';

// Before: a callback building one sandbox per session
new MastraFactory({ sandbox: ctx => new E2BSandbox({ id: ctx.sessionId, sandboxId: ctx.sandboxId }) });

// After: a provider instance, which also carries settings and builds
new MastraFactory({ sandbox: new E2BFactorySandbox() });

// Or run sessions on the host machine, one directory per session
new MastraFactory({ sandbox: new LocalFactorySandbox({ root: '/var/sandboxes' }) });
```

`MastraFactory.sandboxDescription` reports the configured provider, its settings as JSON Schema and its capabilities once `prepare()` has run.
