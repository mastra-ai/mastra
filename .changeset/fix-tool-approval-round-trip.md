---
"@mastra/core": patch
---

fix tool approval round-trip: persist output-denied state and approval object on recall

When a requireApproval tool call is declined or approved, the write path now correctly
persists the approval object and output-denied state so memory.recall() +
toAISdkMessages({ version: 'v6' }) reflects the decision correctly.
