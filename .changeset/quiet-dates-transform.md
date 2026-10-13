---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed TypeScript types for Standard Schemas that transform their input, such as Effect's `Schema.toStandardSchemaV1(Schema.DateFromString)`. Tool `execute` functions now receive the transformed output type instead of a union of input and output types. Tool `requestContextSchema` now accepts these schemas, and tool request context is typed with the transformed output.

```typescript
const DateSchema = Schema.toStandardSchemaV1(Schema.Struct({ date: Schema.DateFromString }));

const tool = createTool({
  id: 'schedule',
  description: 'Schedules an event',
  inputSchema: DateSchema,
  requestContextSchema: DateSchema,
  execute: async ({ date }, { requestContext }) => {
    date.toISOString(); // date is typed as Date
    requestContext.get('date').toISOString(); // request context value is typed as Date
  },
});
```
