---
'@mastra/schema-compat': patch
---

Added `InferPublicSchemaInput`, which infers the input (pre-transform) type of a public schema, and taught `toStandardSchema` to carry a schema's input and output types separately.

`InferPublicSchema` returns a schema's output (post-transform) type; the new `InferPublicSchemaInput` reads the input side where a schema exposes one and falls back to the output type for schemas without a separate input, such as JSON Schema and AI SDK schemas. `toStandardSchema` now accepts `PublicSchema<TOutput, TInput>` and returns `StandardSchemaWithJSON<TInput, TOutput>`, so a transforming schema no longer collapses its two types into one. The single-type-argument call shape (`toStandardSchema<T>`) is unchanged.
