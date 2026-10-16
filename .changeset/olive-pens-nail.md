---
'@mastra/core': minor
---

Added agent version labels, conditional label updates, and immutable execution pins. Use `versions.defaultLabel` to select a label throughout the agent graph. Explicit `versions.agents[agentId]` selectors take precedence for every agent, including the directly invoked agent. When neither is provided, selection falls back to `versions.defaultStatus`, then the existing system default.

```ts
// Existing calls keep their default version selection.
await agent.generate('Hello');

// Apply a label throughout the graph, with an explicit override for one agent.
await agent.generate('Hello', {
  versions: {
    defaultLabel: 'candidate',
    agents: { 'research-agent': { versionId: 'research-v1' } },
  },
});

// Select a label for only the directly invoked agent.
await agent.generate('Hello', { versions: { agents: { [agent.id]: { label: 'candidate' } } } });
```

Replace preview calls using `versions.self` with `versions.agents[agentId]` when selecting only one agent. Use `defaultLabel` for a graph-wide default.

Resolved versions stay pinned across delegation, tool approvals, suspension, continuation, retries, networks, and durable recovery. Moving a label affects new runs, not existing ones. Legacy agent calls preserve the caller's original `RequestContext` instance.

Added label storage to InMemory and Filesystem, with protection against deleting labeled versions. Filesystem conditional-write coordination is limited to one process. Labels are agent-only; prompt blocks and skills are not supported.

Explicit version IDs now reject missing or cross-entity targets across all versioned storage resources instead of falling back. Existing custom storage subclasses remain compatible: the optional `versionParentIdField` ownership hook avoids an extra scoped lookup, but is not required.
