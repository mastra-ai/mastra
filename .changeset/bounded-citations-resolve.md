---
'@mastra/core': minor
---

Added bounded citation resolution for Knowledge importers. An importer can declare a `citations` policy with finite depth, item, and time budgets plus a fetch for its own source; handlers then call `resolveCitations()` to reuse existing authorized bindings, fetch each missing identity at most once, and stop cycles. A run that leaves a required citation unresolved fails without committing state, so its cursor never advances past the dependency.

```ts
importers: [
  {
    id: 'github',
    access: { 'repo:$repo': 'owner' },
    citations: {
      budget: { maxDepth: 3, maxItems: 50, timeoutMs: 30_000 },
      fetch: async ({ address, signal }) => fetchPullRequest(address, signal),
    },
    handler: async ctx => {
      const { complete } = await ctx.resolveCitations!([{ source: 'github', address: 'mastra-ai/mastra:pr:123' }]);
      if (complete) await ctx.state.set('cursor', 'next');
    },
  },
];
```
