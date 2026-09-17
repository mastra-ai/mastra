---
'@mastra/core': minor
---

Added agent version labels, conditional label updates, and immutable execution pins. Root and explicitly selected sub-agents keep their resolved versions across tool approvals, suspension, retries, networks, and durable recovery; moving a label affects new runs, not existing ones.

```ts
// Existing calls keep their default version selection.
await agent.generate('Hello');

// Select the version currently assigned to an existing label.
await agent.generate('Hello', { versions: { self: { label: 'candidate' } } });
```

Added label storage to InMemory and Filesystem, with protection against deleting labeled versions. Filesystem conditional-write coordination is limited to one process. Labels are agent-only; prompt blocks and skills are not supported, and root selections are not inherited by sub-agents.

Explicit version IDs now reject missing or cross-entity targets across all versioned storage resources instead of falling back. Existing custom storage subclasses remain compatible: the optional `versionParentIdField` ownership hook avoids an extra scoped lookup, but is not required.
