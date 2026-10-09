---
'@mastra/core': minor
---

Added `FactorySandbox`, the contract a host implements to plug a sandbox provider into Mastra Factory. Before, Factory took a bare callback that built one `MastraSandbox` per session, so a provider had no way to expose tunable settings, a prebuilt repository template or template builds. A `FactorySandbox` owns all four, and lives in `@mastra/core/workspace` so provider packages implement it without depending on `@mastra/factory`.

**Required:** `provider`, a `settings` schema (zod, JSON Schema or Standard Schema; every field optional, absent means the provider default) and `create`, which returns the session's `MastraSandbox`.

**Optional:** `template` returns the environment's repository template for a context and settings; `builds` starts, reads and lists template builds ahead of any session.

```ts
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import { z } from 'zod';

const settings = z.object({ region: z.enum(['us', 'eu']).optional() });
type Settings = z.infer<typeof settings>;

class MyFactorySandbox extends FactorySandbox<Settings> {
  readonly provider = 'my-cloud';
  readonly settings = settings;

  create(ctx: FactorySandboxContext, { region = 'us' }: Settings) {
    return new MyCloudSandbox({ id: ctx.sessionId, sandboxId: ctx.sandboxId, region });
  }

  // Optional: a template Factory can build before the first session
  template(ctx: FactorySandboxContext, { region = 'us' }: Settings) {
    return myCloudTemplate({ repos: ctx.repos, setup: ctx.workspaceSetupCommand, region });
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

`describeFactorySandbox(sandbox)` reports the provider, its settings as JSON Schema and which optional capabilities it has, which is what Factory serves to its clients.
