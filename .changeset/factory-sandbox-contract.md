---
'@mastra/core': minor
---

`@mastra/core/workspace` exports the `FactorySandbox` host contract: one object a factory host hands over that owns the session sandbox constructor, the repo template factory, a schema of user-tunable settings and an optional `builds` capability.

- `FactorySandbox` interface, `FactorySandboxContext`, `FactoryRepositoryAccess` and the build types
- `FactorySandbox` sets the `Symbol.for('mastra.factory.sandbox')` brand; `isFactorySandbox` detects it
- `describeFactorySandbox` turns the settings schema (zod, JSON Schema or Standard Schema) into JSON Schema and reports `template` and `builds` capabilities

```ts
import { FactorySandbox } from '@mastra/core/workspace';
import { z } from 'zod';

const settings = z.object({ cpuCount: z.number().int().min(1).optional() });

class MyFactorySandbox extends FactorySandbox<z.infer<typeof settings>> {
  readonly provider = 'my-provider';
  readonly settings = settings;
  readonly templateFields = ['cpuCount'] as const;
  create(ctx, settings) {
    return new MySandbox({ id: ctx.sessionId, sandboxId: ctx.sandboxId, cpuCount: settings.cpuCount });
  }
}
```
