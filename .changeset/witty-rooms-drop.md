---
'@mastra/core': minor
'@mastra/editor': minor
'@mastra/server': patch
---

**Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`.

If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

```ts
// Before
const result = await agent.cloneAgent({ newId: 'my-clone' });

// After
const editor = mastra.getEditor();
const result = await editor.agent.clone(agent, { newId: 'my-clone' });
```

**Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

**Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.
