---
'@mastra/core': patch
---

Fixed `InferToolInput`, `InferToolOutput`, `InferUITool`, and `InferUITools` so tools created with `createTool({ outputSchema: z.object(...) })` now produce a typed `{ input, output }` instead of falling through to `never`. UIMessage parts (`tool-<name>`) and other consumers can now discriminate on the inferred input/output types without manual workaround shims.

```ts
const echo = createTool({
  id: 'echo',
  inputSchema: z.object({ x: z.string() }),
  outputSchema: z.object({ y: z.number() }),
  execute: async ({ x }) => ({ y: x.length }),
});

// before: { input: never; output: never }
// after:  { input: { x: string }; output: { y: number } }
type UI = InferUITool<typeof echo>;
```

Closes the gap left by #7184.
