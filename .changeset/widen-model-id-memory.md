---
'@mastra/memory': patch
---

Fix `TS2590: Expression produces a union type that is too complex to represent` in observational memory type checks after the model registry grew. Model config fields are now read into a widened type before being combined, so type checking no longer scales with the number of registered model ids.
