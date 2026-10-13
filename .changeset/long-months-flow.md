---
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
---

Updated agent version selectors across the server and SDKs to support graph-wide `defaultLabel` and explicit per-agent overrides, including the root. Continuations preserve their original immutable graph after labels move.

Replace preview calls using `versions.self` with an entry for the agent ID:

```ts
const support = client.getAgent('support-agent');
await support.generate('Check this candidate.', {
  versions: { agents: { 'support-agent': { label: 'candidate' } } },
});
```

Use `versions: { defaultLabel: 'candidate' }` to select the label throughout the configured agent graph. Per-agent entries take precedence over that default.
