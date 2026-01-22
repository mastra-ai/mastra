---
"@mastra/client-js": patch
"@mastra/core": patch
"@mastra/schema-compat": patch
---

Fix client-side tools with plain JSON Schemas failing with OpenAI's "Invalid schema" error. The fix adds proper detection and handling of plain JSON Schema objects, bypassing unnecessary Zod conversion while maintaining compatibility with Zod-based tools. This resolves serialization issues where JSON Schemas were incorrectly processed, resulting in invalid schema formats being sent to OpenAI.
