---
'@mastra/server': patch
'@mastra/client-js': patch
---

Expose item-level tool mocks through the dataset API and client SDK. Dataset item create/update/batch endpoints accept a `toolMocks` array (toolName + args + output + optional `matchArgs` mode), experiment result responses include the `toolMockReport`, and the client-js types thread `toolMocks` and `toolMockReport` through the dataset item and experiment result types.

```ts
// Author a dataset item with a tool mock the agent will replay during experiments
await client.addDatasetItem({
  datasetId,
  input: { question: 'What is the weather in Tokyo?' },
  toolMocks: [
    { toolName: 'getWeather', args: { city: 'Tokyo' }, output: { tempC: 18 } },
  ],
});
```
