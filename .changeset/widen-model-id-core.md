---
'@mastra/core': patch
---

Add `WidenModelId<T>` and `WidenedMastraModelConfig` type helpers that replace the model-id literal union with `string` for internal plumbing. Public config fields keep `MastraModelConfig` for autocomplete; internal code that merges model values (`??`, ternaries) should widen first so TypeScript does not subtype-reduce the full model registry union.
