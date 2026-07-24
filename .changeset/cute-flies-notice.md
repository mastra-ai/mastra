---
'@mastra/core': patch
---

Fixed request context schema transformations being discarded before tool execution. When a tool's `requestContextSchema` uses transforms (like Zod codecs or coercions), the transformed values are now passed to `execute`, matching what TypeScript infers. Previously the schema was only used for validation and `execute` received the raw untransformed values.

**Before:**

```typescript
const dateCodec = z.codec(z.string(), z.date(), {
  decode: value => new Date(value),
  encode: value => value.toISOString(),
});

const tool = createTool({
  id: 'example',
  requestContextSchema: z.object({ date: dateCodec }),
  async execute(_input, { requestContext }) {
    const value = requestContext.get('date');
    // TypeScript says Date, but at runtime it was still a string
  },
});
```

**After:** `requestContext.get('date')` returns an actual `Date` instance, consistent with how `inputSchema` and `outputSchema` already apply transformed values. Keys not covered by the schema are preserved as-is.
