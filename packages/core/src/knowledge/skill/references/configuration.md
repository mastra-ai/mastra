# Configuration

Create one application-wide `Knowledge` instance and register it under a stable key.

```ts
import { Knowledge } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';
import { Mastra } from '@mastra/core/mastra';

const knowledge = new Knowledge({
  id: 'mastra',
  storage: new LibSQLStore({
    id: 'knowledge-storage',
    url: 'file:./mastra.db',
  }),
});

export const mastra = new Mastra({
  knowledge: { knowledge },
});
```

Use a durable adapter in production. Knowledge owns graph state, grants, import state, proposals, activity, and the semantic outbox; restart-sensitive features can't rely on process memory.

## Reconcile structure

Supply `structure` when the host knows the exact initial shape. Scope addresses are stable lookup keys, not hierarchy syntax.

```ts
const knowledge = new Knowledge({
  id: 'mastra',
  storage,
  structure: {
    scopes: [
      { address: 'org:acme', name: 'Acme' },
      {
        address: 'shared-product',
        name: 'Shared product',
        parentAddresses: ['org:acme'],
      },
    ],
  },
});

await knowledge.reconcile();
```

A direct plan is authoritative for its declared parent memberships and grants. Reapplying the same plan is idempotent, and undeclared scopes aren't pruned.

## Compile descriptions

A compiler converts `description` into a validated `KnowledgeStructurePlan`. Plans are cached by normalized-description hash in thread-state storage, resume from persisted checkpoints, and are judged against live graph state.

```ts
const knowledge = new Knowledge({
  id: 'mastra',
  storage,
  description: 'Shared product knowledge with private planning areas.',
  compiler: {
    async compile(input, context) {
      await context.saveCheckpoint({ stage: 'planned' });
      return planningService.compile(input.description);
    },
  },
});
```

A direct `structure` takes precedence over a description. Compiled plans declare structure, never knowledge records.

## Scope templates

Host-declared scope descriptions compile once per scope type and apply with copy-on-create semantics.

```ts
const knowledge = new Knowledge({
  id: 'mastra',
  storage,
  compiler,
  scopes: {
    'project:$projectId': {
      access: [{ principal: 'self', role: 'owner' }],
      description: 'Create decisions and docs child scopes.',
    },
  },
});
```

Template placeholders include `$scope`, `$self`, and `$parent` when the concrete scope has exactly one parent. `$self` resolves to the materialization's `contextualScopeAddress`, which may differ from the new scope address. Changing a template affects future materialization only; existing concrete scopes aren't retrofitted.
