---
'@mastra/core': minor
'@mastra/editor': minor
---

Added `requestContextSchema` and rule-based conditional fields for stored agents.

Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

**New `requestContextSchema` field**

Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

**Conditional field example**

```ts
await agentsStore.create({
  agent: {
    id: 'my-agent',
    name: 'My Agent',
    instructions: 'You are a helpful assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: [
      { value: { 'basic-tool': {} } },
      {
        value: { 'premium-tool': {} },
        rules: {
          operator: 'AND',
          conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
        },
      },
    ],
    requestContextSchema: {
      type: 'object',
      properties: { tier: { type: 'string' } },
    },
  },
});
```
