---
'@mastra/schema-compat': patch
---

Fixed structured output validation failing when OpenAI returns null for an optional field inside a nullable object or array. These nulls are now treated as missing values, the same as they already were for non-nullable parents.
