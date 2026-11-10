---
'@mastra/core': patch
---

`Mastra.addAgent` now throws `MASTRA_ADD_AGENT_DUPLICATE_KEY` when a different agent is registered under an occupied key instead of silently skipping it. To replace an agent, call the public removal API first:

```ts
// Before: the second agent was silently skipped; the first remained registered.
mastra.addAgent(firstAgent, 'shared');
mastra.addAgent(secondAgent, 'shared');

// After: remove the first agent explicitly before registering its replacement.
mastra.removeAgent('shared');
mastra.addAgent(secondAgent, 'shared');
```

Re-registering the same agent remains a no-op. Stored-agent rehydration also preserves the registered instance, and controller modes sharing an agent ID remain usable.
