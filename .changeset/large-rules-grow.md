---
'@mastra/core': minor
---

Register `Harness` instances on `Mastra`.

Pass harnesses to `new Mastra({ harnesses })` (keyed like agents and workflows) and look them up with `mastra.getHarness(key)`, `mastra.getHarnessById(id)`, or `mastra.listHarnesses()`. A registered Harness shares the parent Mastra — its storage, agents, gateways, and observability — instead of building its own internal one, and is torn down with `mastra.shutdown()`. A standalone Harness is unchanged. This is the foundation for serving Harness sessions over HTTP.

```typescript
const code = new Harness({ id: 'code', modes });
const mastra = new Mastra({ harnesses: { code }, storage });

mastra.getHarness('code') === code; // by registration key
code.getMastra() === mastra; // shares the parent Mastra and its storage
```
