---
'@mastra/schema-compat': patch
---

Fixed a packaging issue where `JSONSchema7` type imports could resolve to `any` for consumers without `@types/json-schema`, breaking type inference in `createTool` and other schema utilities.
