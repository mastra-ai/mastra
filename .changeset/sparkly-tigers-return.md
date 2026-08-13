---
'@mastra/core': patch
---

Fixed `requestContextSchema` typing so it matches the open-map runtime without losing declared-key safety, and restored assignability of schema-typed agents to bare `Agent`.

Declared keys on `get`/`set`/`has`/`delete` stay strictly typed (typos still fail). Runtime-only keys — including reserved middleware keys like `mastra__resourceId` — are available through `getRaw`/`setRaw`/`hasRaw`/`deleteRaw`, which return/accept `unknown` instead of forcing `as never` casts.

Also fixed generic helpers typed as `(agent: Agent) => ...` rejecting agents that declare a `requestContextSchema` (`TRequestContext` now defaults to `any` on `Agent`/`SubAgent` so the invariant generic remains assignable).

```ts
const ctx = new RequestContext<{ tenantTier?: 'free' | 'pro' }>();
ctx.set('tenantTier', 'pro');
ctx.setRaw('session.cache', { hits: 0 });
const cache = ctx.getRaw('session.cache'); // unknown

const schemaAgent = new Agent({
  id: 'repro',
  name: 'repro',
  instructions: 'hi',
  model: 'openai/gpt-4o',
  requestContextSchema: z.object({ tenantTier: z.enum(['free', 'pro']).optional() }),
});
declare function driveAgent(agent: Agent): Promise<void>;
void driveAgent(schemaAgent); // ok
```

Fixes #21286
