---
"@mastra/core": patch
---

Fixed `generateEmptyFromSchema` crashing on pre-parsed object schemas and returning `{}` for nested object properties. The function now accepts both string and object inputs, recursively initializes nested objects, and respects `default` values defined in schema properties.
