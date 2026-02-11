---
'@mastra/core': minor
---

Add `inputExamples` support on tool definitions to show AI models what valid tool inputs look like. Models that support this (e.g., Anthropic's `input_examples`) will receive the examples alongside the tool schema, improving tool call accuracy.

- Added optional `inputExamples` field to `ToolAction`, `CoreTool`, and `Tool` class

```ts
const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get weather for a location',
  inputSchema: z.object({
    city: z.string(),
    units: z.enum(['celsius', 'fahrenheit']),
  }),
  inputExamples: [
    { input: { city: 'New York', units: 'fahrenheit' } },
    { input: { city: 'Tokyo', units: 'celsius' } },
  ],
  execute: async ({ city, units }) => {
    return await fetchWeather(city, units);
  },
});
```
