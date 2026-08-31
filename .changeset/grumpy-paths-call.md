---
'@mastra/core': minor
---

Added movable label selectors and root `versions.self` overrides for versioned agents. Mastra resolves root and explicit sub-agent selectors to immutable IDs before behavior starts, then keeps those pins across legacy execution, suspension, approvals, experiment item retries, networks, and durable recovery. Explicit label and version-ID selectors fail closed, and a root selector isn't inherited by delegated sub-agents.

```ts
await agent.generate('Hello', { versions: { self: { label: 'candidate' } } });
```
