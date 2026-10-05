---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/react': patch
---

Added optional `rules` to `prompt_block_ref` instruction blocks so stored agents can save and preview per-usage display conditions on prompt block references.

```ts
await client.getStoredAgent('support-agent').update({
  instructions: [
    {
      type: 'prompt_block_ref',
      id: 'default-user-prompt',
      rules: { operator: 'AND', conditions: [{ field: 'userPrompt', operator: 'not_exists' }] },
    },
  ],
});
```
