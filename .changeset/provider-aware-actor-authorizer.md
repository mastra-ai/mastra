---
'@mastra/core': minor
---

Added optional provider-driven authorization for system (non-user) actors, enabling per-agent least privilege for autonomous and cron agents that previously bypassed fine-grained authorization (FGA) entirely.

System actors (`actor: { actorKind: 'system' }` or `actor: true`) skip the user-centric FGA path. Previously the only boundary for them was tenant scope — there was no way to constrain which agent could do what, and no deny path. FGA providers can now opt in to enforce least privilege for those actors.

**What's new**

- `IFGAProvider` gains two optional methods: `requireActor(actor, params)` (throws `FGADeniedError` to deny) and `checkActor(actor, params)` (returns a boolean).
- `ActorSignal` gains optional `agentId`, `permissions`, and `scope` so a provider can identify and constrain the acting agent. `permissions` reuses the `MastraFGAPermissionInput` vocabulary — the actor analog of a user's resolved permissions.
- When a provider does not implement `requireActor`, the existing trusted-actor bypass is preserved exactly — this change is fully backward compatible.

**Before** — system actors always bypassed FGA:

```ts
// Cron/system run: FGA is skipped, no per-agent limits are possible.
await agent.generate('run nightly report', {
  actor: { actorKind: 'system', sourceWorkflow: 'nightly' },
});
```

**After** — a provider enforces least privilege on the acting agent:

```ts
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { FGADeniedError } from '@mastra/core/auth/ee';

class MyFga implements IFGAProvider {
  // ...existing check / require / filterAccessible...

  async requireActor(actor, { resource, permission }) {
    const granted = actor === true ? [] : (actor.permissions ?? []);
    if (!granted.includes(permission)) {
      throw new FGADeniedError(null, resource, permission, 'actor lacks required permission');
    }
  }
}

// The acting agent is now identified and constrained by its granted permissions.
await agent.generate('run nightly report', {
  actor: {
    actorKind: 'system',
    agentId: 'nightly-agent',
    permissions: ['agents:execute', 'tools:execute'],
  },
});
```
