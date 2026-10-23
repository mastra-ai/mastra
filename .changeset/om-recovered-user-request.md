---
'@mastra/core': patch
'@mastra/memory': patch
---

Keep the current user request and delayed tool results in the prompt when a durable Observational Memory turn resumes on another worker. Preserve completed live background results when reconciling stored messages.
