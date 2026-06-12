---
"@mastra/core": patch
"@mastra/memory": patch
---

Fixed tool approval round-trip persistence for recalled messages.

When a requireApproval tool call is declined or approved, the write path now correctly
persists the approval object and output-denied state so memory.recall() +
toAISdkMessages({ version: 'v6' }) reflects the decision correctly.
