---
'@mastra/schema-compat': patch
---

Fixed optional union fields in OpenAI tool schemas. Tools can now use `null` when those fields have no value.

Fixes https://github.com/mastra-ai/mastra/issues/26703
