---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/editor': minor
'@mastra/client-js': minor
---

Added optional `metadata` to code-defined agents. Pass a `metadata` record to `new Agent({...})`, read it back with `agent.getMetadata()`, and clients can filter on it from the existing `/agents` and `/agents/:agentId` responses without encoding the data into IDs or names.

Metadata supports the same `DynamicArgument` form as other agent config fields, so it can also be resolved per request from the request context.

Stored agents loaded via the editor also expose their metadata through `agent.getMetadata()`, so clients can filter these agents as well. Cloning a runtime agent via `editor.agent.clone()` now carries the source agent's metadata over to the stored clone when the caller does not provide one explicitly.

```ts
// Static
const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'You help customers with support requests.',
  model: 'openai/gpt-5',
  metadata: { type: 'support' },
});

supportAgent.getMetadata(); // { type: 'support' }

// Dynamic
const tenantAgent = new Agent({
  id: 'tenant-agent',
  name: 'Tenant Agent',
  instructions: 'You help customers with tenant-specific tasks.',
  model: 'openai/gpt-5',
  metadata: ({ requestContext }) => ({
    type: 'support',
    tenant: requestContext.get('tenant'),
  }),
});

await tenantAgent.getMetadata({ requestContext }); // { type: 'support', tenant: 'acme' }
```
