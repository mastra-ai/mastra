---
'@mastra/core': patch
---

Fix `InferToolInput` / `InferToolOutput` / `InferUITool` / `InferUITools` falling through to `never` for tools with a concrete `outputSchema`. The exact-match `unknown` constraints in the trailing generic slots are replaced with `infer _` placeholders so tools authored via the canonical `createTool({ outputSchema: z.object(...) })` shape now produce typed `{ input, output }` instead of `never`. Closes the gap left by #7184.
