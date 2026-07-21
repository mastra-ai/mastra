---
'@mastra/core': minor
---

Added optional provider-driven authorization for system (non-user) actors, enabling per-agent least privilege after tenant scope has been validated.

System actors (`actor: { actorKind: 'system' }` or `actor: true`) skip the user-centric FGA path. Previously the only boundary for them was tenant scope — there was no way to constrain which agent could do what, and no deny path. FGA providers can now opt in to enforce least privilege for those actors.

**What's new**

- `IFGAProvider` gains an optional `requireActor(actor, params)` method that throws `FGADeniedError` to deny.
- `ActorSignal` gains optional `agentId`, `permissions`, and `scope` so a provider can identify and constrain the acting agent. `permissions` reuses the `MastraFGAPermissionInput` vocabulary — the actor analog of a user's resolved permissions. It is a self-asserted claim: a provider enforcing real least privilege should resolve authoritative grants from a trusted source keyed by `agentId` rather than trusting it directly.
- When a provider does not implement `requireActor`, the existing trusted-actor bypass is preserved exactly — this change is fully backward compatible.

**Before** — system actors had tenant scoping but no provider-defined per-agent authorization:

```ts
// Cron/system run: tenant scope is required, but no per-agent limits are possible.
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
    const agentId = actor === true ? undefined : actor.agentId;
    // Resolve authoritative grants from a trusted source keyed by agentId.
    const granted = await this.grantsForAgent(agentId);
    // `permission` may be a single value or an array (needs ANY one of them).
    const required = Array.isArray(permission) ? permission : [permission];
    if (!required.some(p => granted.includes(p))) {
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
