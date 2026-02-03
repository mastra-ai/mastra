---
'@mastra/core': patch
'@mastra/schema-compat': patch
---

**@mastra/core**

Fixed type errors in `MastraLLMV1.generate()` and `stream()` methods. The `args` parameter is now optional, allowing callers to pass only messages without causing runtime errors.

**@mastra/schema-compat**

- Fixed async validation in `AiSdkSchemaWrapper` to properly handle rejected promises by returning the expected `{ issues: [...] }` shape instead of causing unhandled rejections.
- Added defensive checks in `defaultZodOptionalHandler` to prevent runtime errors when accessing nested properties on Zod v4 optional types.
