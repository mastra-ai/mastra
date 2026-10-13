---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed TypeScript types for Standard Schemas that transform their input, such as Effect's `Schema.toStandardSchemaV1(Schema.DateFromString)`. Tool `execute` functions now receive the transformed output type instead of a union of input and output types. `requestContextSchema` on tools, agents, and workflows now accepts these schemas, and request context is typed with the transformed output.

```typescript
const tool = createTool({
  id: 'schedule',
  description: 'Schedules an event',
  inputSchema: Schema.toStandardSchemaV1(Schema.Struct({ date: Schema.DateFromString })),
  execute: async ({ date }) => date.toISOString(), // date is typed as Date
});
```
