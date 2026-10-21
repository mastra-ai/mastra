---
'@mastra/core': minor
'@mastra/editor': minor
---

Added opt-in Editor ownership and versioned persistence for static model fallback lists.

```ts
new Agent({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Help users resolve support requests.',
  model: [
    { id: 'primary', model: 'openai/gpt-4o' },
    { id: 'fallback', model: 'openai/gpt-4o-mini' },
  ],
  editor: { model: true },
});
```
