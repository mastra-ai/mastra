---
'@mastra/editor': minor
---

Added per-usage display conditions to prompt block references. A `prompt_block_ref` instruction can now carry its own `rules`, so an agent can include a shared stored block only in specific situations without adding rules to the shared block itself. If the stored block has rules too, both must pass.

This makes it possible to insert a runtime value from request context and fall back to a shared default block when the value is missing (#17878):

```ts
instructions: [
  { type: 'text', content: 'Follow the platform safety policy.' },
  {
    type: 'prompt_block',
    content: '{{userPrompt}}',
    rules: { operator: 'AND', conditions: [{ field: 'userPrompt', operator: 'exists' }] },
  },
  {
    type: 'prompt_block_ref',
    id: 'default-user-prompt',
    rules: { operator: 'AND', conditions: [{ field: 'userPrompt', operator: 'not_exists' }] },
  },
];
```
