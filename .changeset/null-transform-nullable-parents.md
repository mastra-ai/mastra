---
'@mastra/schema-compat': patch
---

Fixed structured output validation failing when optional fields inside `.nullable()` or `.nullish()` objects or arrays were returned as `null`. They are now dropped, matching the behavior for non-nullable parents.
