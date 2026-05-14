---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/editor': minor
'@mastra/client-js': minor
---

Added optional `metadata` to code-defined agents. Pass a `metadata` record to `new Agent({...})`, read it back with `agent.getMetadata()`, and clients can filter on it from the existing `/agents` and `/agents/:agentId` responses without encoding the data into IDs or names.

Stored agents loaded via the editor also expose their metadata through `agent.getMetadata()`, so clients can filter these agents as well.

```ts
const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'You help customers with support requests.',
  model: 'openai/gpt-5',
  metadata: { type: 'support' },
});

supportAgent.getMetadata(); // { type: 'support' }
```
