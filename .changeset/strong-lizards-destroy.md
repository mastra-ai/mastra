---
"@mastra/core": minor
---

Added structured JSON response for declined HITL tool approvals

When a human-in-the-loop tool approval is declined, `@mastra/core` now returns a structured object instead of a hard-coded English string. The old response was a opaque string that required fragile string-matching to detect; the new response is a well-defined machine-readable shape:

```ts
// Old (removed):
result: 'Tool call was not approved by the user'

// New:
result: {
  status: 'denied',
  approved: false,
  reason: 'The amount exceeded the daily limit' // or null when not provided
}
```

The `reason` field is populated from `resumeData.reason` when present, otherwise `null`. This applies consistently across the agentic-execution loop, the durable agent build, and the network tool execution path.
