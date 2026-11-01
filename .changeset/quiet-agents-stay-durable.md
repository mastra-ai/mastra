---
'@mastra/core': patch
---

Fixed `new Agent({ durable: true })` running non-durably once registered on Mastra. Calls on the agent instance you created (`stream`, `generate`, `resume`, `resumeStream`, `approveToolCall`, etc.) now run through the durable wrapper Mastra registered for it, the same as calls on `mastra.getAgent()`. Fixes #28189.

```ts
const agent = new Agent({ id: 'support', durable: true /* ... */ });
const mastra = new Mastra({ agents: { support: agent }, storage });

// Previously ran the plain loop; now runs durably and can be resumed
const stream = await agent.stream('Delete the record');
```
