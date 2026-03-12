---
'@mastra/schema-compat': patch
---

Fixed Zod 4 schema conversions failing in ESM projects with the error `"z.toJSONSchema is not available. Ensure zod >= 3.25.0 is installed."` This affected structured outputs, tool input schemas, and workflow step schemas when using Zod 4 in a project with `"type": "module"`.
