---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed JSON Schema `format` keywords being ignored during validation. Values such as `"not-an-email"` for a `format: "email"` property used to pass; they now fail validation. This applies to the standard formats like `email`, `uri`, `date-time`, `uuid` and `ipv4`.
