---
'@mastra/schema-compat': patch
---

Fixed schema-compat ESM imports for Zod JSON Schema helpers.

@mastra/schema-compat no longer uses createRequire in its Zod v4 adapter or runtime eval tests, which avoids createRequire-related ESM issues while preserving support for zod/v3 and zod/v4.
