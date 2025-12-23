---
'@mastra/schema-compat': patch
---

Fixes #11016

When MCP tools with optional fields were used with OpenAI models, validation failed with "Required" errors when OpenAI omitted those fields.

The issue was in `OpenAISchemaCompatLayer.processZodType()` - it converted `.optional()` to just `.nullable().transform()`, which made fields required (but nullable) instead of truly optional.

Before:

```ts
// .optional() -> .nullable().transform()
return processedInner.nullable().transform(val => (val === null ? undefined : val));
```

After:

```ts
// .optional() -> .nullable().optional().transform()
return processedInner
  .nullable()
  .optional()
  .transform(val => (val === null ? undefined : val));
```

The order matters here - `nullable().optional().transform()` keeps the field in the JSON Schema's `required` array (because transform is outermost), but validation now accepts both `null` and `undefined`.
