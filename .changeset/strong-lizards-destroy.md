---
"@mastra/core": minor
---

HITL: return structured JSON for declined tool approvals instead of hard-coded English string

When a human-in-the-loop tool approval is declined, `@mastra/core` now returns a structured object `{ status: 'denied', approved: false, reason }` instead of the hard-coded English string `'Tool call was not approved by the user'`. The `reason` field is populated from `resumeData.reason` when present, otherwise `null`.

This applies consistently across the agentic-execution loop, the durable agent build, and the network tool execution path.
