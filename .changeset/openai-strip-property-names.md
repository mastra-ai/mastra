---
'@mastra/schema-compat': patch
---

Fixed OpenAI tool and structured-output requests failing when a schema used `z.record(...)`. Records emit a `propertyNames` JSON Schema keyword, which OpenAI Structured Outputs strict mode rejects, so the whole request was returning an "Invalid schema" error.

Records are not directly expressible in strict mode (it requires `additionalProperties: false` on every object), so the OpenAI compatibility layer now rewrites them into shapes strict mode accepts — without losing the record semantics:

- **Enum keys** (`z.record(z.enum([...]), V)`): expanded into a closed object with one property per key.
- **Arbitrary string keys** (`z.record(z.string(), V)`): the model is asked for an array of `{ key, value }` pairs, which the validation layer folds back into a plain object before it reaches your tool or structured output — so you still receive a `Record<string, V>`.
- Any remaining `propertyNames` keywords (e.g. a record at the schema root) are stripped, mirroring the Google layer.

```ts
// Previously rejected by OpenAI with an "Invalid schema" error;
// now accepted, and `metadata` arrives as a real Record<string, string>.
const tool = createTool({
  inputSchema: z.object({ metadata: z.record(z.string(), z.string()) }),
  // ...
});
```

This covers both standard OpenAI models (e.g. `gpt-4o`) and OpenAI reasoning models (e.g. `o3-mini`), which share the same compatibility layer.
