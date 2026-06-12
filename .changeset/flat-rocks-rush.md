---
'@mastra/schema-compat': patch
---

Fixed a crash when converting Zod v4 schemas containing `z.record(...)` through `applyCompatLayer` with any provider compat layer attached (e.g. `GoogleSchemaCompatLayer`, `OpenAISchemaCompatLayer`).

Fixes [#17051](https://github.com/mastra-ai/mastra/issues/17051).
