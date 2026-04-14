---
'@mastra/core': minor
---

**Added**
Added per-tool strict mode for providers that support strict tool calling. You can now set `strict: true` on `createTool()` and Mastra will forward it when preparing tool definitions.

```ts
const weatherTool = createTool({
  id: 'weather',
  description: 'Get weather for a city',
  strict: true,
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city }),
});
```
