---
'@mastra/client-js': patch
---

Clients can now send the full `generateTitle` configuration with a memory config: `minMessages` (minimum thread messages before a title is generated), `emitEvent` (stream the generated title as a transient `data-thread-title` chunk before `finish`), and an optional `model` (defaults to the agent's model).

```ts
const agent = client.getAgent('assistant');

const response = await agent.stream('Plan my trip to Kyoto', {
  memory: {
    thread: 'thread-1',
    resource: 'user-1',
    options: {
      generateTitle: { emitEvent: true, minMessages: 2 },
    },
  },
});

await response.processDataStream({
  onChunk: async chunk => {
    if (chunk.type === 'data-thread-title') {
      console.log(chunk.data.threadId, chunk.data.title);
    }
  },
});
```
