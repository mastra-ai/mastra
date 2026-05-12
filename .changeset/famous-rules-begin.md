---
'@mastra/nestjs': patch
---

Fixed NestJS route matching to enforce the configured Mastra prefix and preserve query parameter identifiers as strings.

Query parameters are no longer auto-coerced to numbers; handlers should coerce numeric values explicitly.
