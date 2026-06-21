---
'@mastra/core': minor
---

Allow `Harness` instances to be registered on a `Mastra` instance via `new Mastra({ harnesses })`, reachable through `mastra.getHarness(id)` and `mastra.listHarnesses()` (matching the `getAgent`/`listAgents` convention).

Harnesses are keyed by id (like agents and workflows), so one Mastra can host several — e.g. a `code` harness and a `support` harness — each with its own modes and agents. A registered Harness uses the parent Mastra (its storage, agents, gateways, and observability) instead of building its own internal one during `init()`. A standalone Harness keeps creating its internal Mastra exactly as before, so existing consumers (e.g. MastraCode) are unaffected. The rule is simply: use the injected Mastra if registered, otherwise the lazily-created internal one.

This is the foundation for exposing Harness sessions over HTTP through the Mastra server.

```typescript
const code = new Harness({ id: 'code', modes });
const support = new Harness({ id: 'support', modes });
const mastra = new Mastra({ harnesses: { code, support }, storage });

mastra.getHarness('code') === code; // true
code.getMastra() === mastra; // true — no separate internal Mastra
```
