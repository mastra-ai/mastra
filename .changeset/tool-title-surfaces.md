---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/react': patch
---

Expose the optional tool `title` on the tool endpoints and in `GetToolResponse`, and copy it from `tool-call` and `tool-call-input-streaming-start` chunks onto the tool-invocation message part in the `useChat` accumulator. Part of #20249.

```ts
const tool = await client.getTool('get_weather_by_coordinates').details();
tool.title; // 'Weather Lookup'
```
