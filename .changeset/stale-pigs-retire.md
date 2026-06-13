---
'@mastra/core': patch
---

Fixed `createTool`'s `execute` callback `inputData` parameter being typed as `any` instead of the inferred schema type when using Zod schemas. TypeScript now correctly infers the input type without requiring explicit annotation.
