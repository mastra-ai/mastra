---
"@mastra/schema-compat": patch
---

Fixed `createTool` execute callback `inputData` parameter being typed as `any` instead of the inferred schema type.

The `@types/json-schema` package was declared only in `devDependencies`, so consumers without it in their dependency tree got `JSONSchema7` resolving to `any`, which collapsed `InferPublicSchema` to `any` and caused `inputData` to lose its type. Moving `@types/json-schema` to `dependencies` ensures it is always available.

Fixes #17826
