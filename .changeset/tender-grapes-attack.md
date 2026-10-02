---
'@mastra/editor': minor
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Stored agents can now use a memory instance registered on your Mastra instance instead of copying its config. Set `memory` to `{ type: 'id', memoryId: '<registry key>' }` and the agent uses that exact instance, including its storage, processors, and working memory settings. Many stored agents can share one memory setup.

```ts
const mastra = new Mastra({
  memory: { supportMemory },
  editor: new MastraEditor(),
});

await mastra.getEditor()!.agent.create({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Help customers.',
  model: { provider: 'openai', name: 'gpt-5' },
  memory: { type: 'id', memoryId: 'supportMemory' },
});
```

If the key isn't registered, the agent loads without memory and a warning names the missing key. Existing inline memory configs keep working. Cloning an agent that uses registered memory now stores a reference instead of a copy. Fixes #21890.
