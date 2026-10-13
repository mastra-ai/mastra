---
'@mastra/core': minor
---

Added graph-wide agent version defaults with `versions.defaultLabel`. Explicit `versions.agents` entries take precedence for every agent, including the directly invoked agent.

```typescript
await supervisor.generate('Research this topic', {
  versions: {
    defaultLabel: 'candidate',
    agents: { 'research-agent': { versionId: 'research-v1' } },
  },
});
```

Replace preview calls using `versions.self` with `versions.agents[agentId]` when selecting only one agent. Use `defaultLabel` to select a label throughout the agent graph.

Resolved versions stay pinned across delegation, suspension, retries, and recovery. Legacy agent calls also preserve the caller's original `RequestContext` instance.
