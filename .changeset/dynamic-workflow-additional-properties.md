---
'@mastra/core': patch
---

Fixed dynamic workflows dropping input, output, and state fields that are not listed in `properties`. Stored object schemas now follow JSON Schema `additionalProperties`: extra fields are kept when it is missing, `true`, or `{}`, kept and validated when it is a schema (for example record schemas), and stripped only when it is `false`.
