---
'@mastra/core': minor
---

Added movable label selectors and root `versions.self` overrides for versioned agents.

```ts
await agent.generate('Hello', { versions: { self: { label: 'candidate' } } });
```
