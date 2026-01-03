---
'@mastra/braintrust': patch
---

Fix Date objects showing as empty objects in Braintrust traces

Date objects in tool parameters, outputs, and metadata were appearing as `{}` in Braintrust traces. Now they're properly serialized as ISO strings.

Before: `{ scheduledAt: {} }`
After: `{ scheduledAt: "2025-01-15T10:30:00.000Z" }`

