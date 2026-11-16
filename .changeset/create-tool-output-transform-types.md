---
'@mastra/core': patch
---

`createTool` callbacks can now return the input shape of a transformed `outputSchema`. Previously the `execute` return type was the schema's post-transform output, so a transformed output schema rejected perfectly correct code:

```ts
createTool({
  id: 'counter',
  description: 'Reads a count',
  outputSchema: z.object({ count: z.string().transform(Number) }),
  // Now allowed — the callback returns the pre-transform shape.
  execute: async () => ({ count: '42' }),
});
```

The value returned to tool callers and output handlers is still the transformed output (`{ count: number }`), which is what the runtime already produced. `execute` returning the already-transformed shape is now a type error, matching the runtime behaviour that rejects it during output validation.
