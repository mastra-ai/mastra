---
'@mastra/core': minor
---

Added `FactorySandbox`, the contract a host implements to plug a sandbox provider into Mastra Factory. The bare callback that builds one `MastraSandbox` per session still works, but it gives a provider no way to expose tunable settings, a prebuilt repository template or template builds. A `FactorySandbox` owns all four, and lives in `@mastra/core/workspace` so provider packages implement it without depending on `@mastra/factory`.

**Required:** `provider` and `create`, which returns the session's `MastraSandbox`.

**Optional:** `settings`, a schema of what a user can tune (zod, JSON Schema or Standard Schema; every field optional, absent means the provider default; no settings when omitted); `template` returns the environment's repository template for a context and settings; `builds` starts, reads and lists template builds ahead of any session.

```ts
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import type { PublicSchema } from '@mastra/core/schema';

interface Settings {
  region?: 'us' | 'eu';
}

class MyFactorySandbox extends FactorySandbox<Settings> {
  readonly provider = 'my-cloud';
  readonly settings: PublicSchema<Settings> = {
    type: 'object',
    properties: { region: { type: 'string', enum: ['us', 'eu'], default: 'us' } },
    additionalProperties: false,
  };

  create(ctx: FactorySandboxContext, settings: Settings) {
    return new MyCloudSandbox({
      id: ctx.sessionId,
      sandboxId: ctx.sandboxId,
      template: this.template(ctx, settings),
      workingDirectory: ctx.workingDirectory,
      region: settings.region ?? 'us',
    });
  }

  // Optional: the sandbox template image Factory can build ahead of time
  template(ctx: FactorySandboxContext, settings: Settings) {
    return myCloudTemplate(ctx, settings);
  }

  // Optional: build that template ahead of time and report on it
  readonly builds = {
    start: async (ctx: FactorySandboxContext, settings: Settings) =>
      myCloud.startBuild(this.template(ctx, settings)),
    get: async (ctx: FactorySandboxContext, settings: Settings, buildId: string) => myCloud.buildStatus(buildId),
    list: async (ctx: FactorySandboxContext, settings: Settings) => myCloud.builds(this.template(ctx, settings).name),
  };
}
```
