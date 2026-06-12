---
'@mastra/schema-compat': patch
---

Fixed tool-call and structured-output validation failing with "expected <type>, received null" when a tool or output schema used `.default()` or `.optional()` fields and the model left them out.

In strict structured-output and tool-calling mode, validation now handles missing optional and defaulted fields consistently across providers.

Fixed behavior:
- `.optional()` fields now treat model-returned `null` as missing input.
- `.default()` fields now apply fallback values when models return `null`.
- `.nullable()` fields still preserve explicit `null`.

This fix applies to OpenAI, Google, Anthropic, DeepSeek, and Meta.

```ts
// Before: this tool failed when the model omitted `limit`
const search = createTool({
  id: 'search',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().default(10), // model returns null → "expected number, received null"
  }),
  // ...
});

// After: `limit` correctly falls back to 10
```
