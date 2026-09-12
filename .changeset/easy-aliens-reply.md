---
'@mastra/schema-compat': patch
---

Fixed OpenAI structured output rejecting optional scalar properties whose schema was declared with `enum` or `const`. The compatibility layer now infers the scalar `type` from those values before nullable wrapping, so an optional property accepts `null` and its permitted values instead of failing schema conversion.
