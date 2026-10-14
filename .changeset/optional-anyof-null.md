---
'@mastra/schema-compat': patch
---

Fixed optional union fields losing their empty value when converted for OpenAI strict mode. An optional `anyOf` property stays required, and now also allows `null`, so the omitted value can still be represented.

Fixes https://github.com/mastra-ai/mastra/issues/26703
