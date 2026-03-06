---
'@mastra/server': minor
---

Fixed server tool serialization for plain JSON Schema objects to prevent tools from disappearing in Studio.

Updated `@mastra/server` peer dependency minimum for `@mastra/core` to include the new `asJsonSchema` export used by server schema serialization.
