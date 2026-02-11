---
'@mastra/client-js': minor
---

Add clone agent feature. Code-defined or stored agents can be cloned into new stored agents via the client SDK:

```ts
const client = new MastraClient();
const cloned = await client.getAgent('my-agent').clone({
  newName: 'My Agent Copy',
  requestContext: { workspace: 'dev' },
});
```

The clone serializes the agent's full resolved configuration — model, instructions, tools, workflows, sub-agents, memory, input/output processors, and scorers — using the caller's `requestContext` and persists it as a new stored agent.
