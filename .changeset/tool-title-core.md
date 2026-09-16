---
'@mastra/core': minor
---

Add an optional `title` to `createTool()` so a tool call can carry a human-readable display name. Closes #20249.

The title is never sent to the model. It is stamped on the `tool-call-input-streaming-start` and `tool-call` stream chunks and persisted on the stored tool-invocation part, so a chat UI can label the call after a reload without a client-side name catalog.

```ts
const weatherTool = createTool({
  id: 'get_weather_by_coordinates',
  title: 'Weather Lookup',
  description: 'Fetches the current weather for a latitude/longitude pair',
  inputSchema: z.object({ lat: z.number(), lon: z.number() }),
  execute: async ({ lat, lon }) => fetchWeather(lat, lon),
});
```
