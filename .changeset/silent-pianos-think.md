---
'@mastra/core': minor
---

Added tool definitions to MODEL_GENERATION span attributes. The tools made available to the model (name, description, and JSON-schema parameters) are now captured once per generation as the `tools` attribute, so observability exporters can surface which tool schemas the model ran with. Per-step tool names (after `activeTools` filtering) remain on MODEL_INFERENCE spans as `availableTools`. Related: #20242

```typescript
// Any exporter reading MODEL_GENERATION spans now receives:
span.attributes.tools;
// [
//   {
//     type: 'function',
//     name: 'get_weather',
//     description: 'Get the weather for a city',
//     parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
//   },
// ]
```
