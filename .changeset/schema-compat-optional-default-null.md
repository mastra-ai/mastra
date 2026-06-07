---
'@mastra/schema-compat': patch
---

Fixed tool-call and structured-output validation failing with "expected <type>, received null" when a tool or output schema used `.default()` or `.optional()` fields and the model left them out.

In strict structured-output / tool-calling mode, providers return `null` for a non-required field instead of omitting it. The AI SDK schema produced by `processToAISDKSchema` was built from Zod's *output* projection, where `.default()` fields are required, and only the OpenAI compat layer normalized the returned `null` back to `undefined`. As a result `.default()` fields broke on every provider, and `.optional()` fields broke on Google, Anthropic, DeepSeek, and Meta.

The schema is now built from the *input* projection (so defaulted fields are optional, matching what the model is asked to produce), and a shared `convertOptionalNullsToUndefined` helper normalizes `null` → `undefined` for optional/defaulted fields across all providers, while preserving explicit `null` for `.nullable()` fields.

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
