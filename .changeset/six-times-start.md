---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Add an explicit `useAgent` flag for separate structured output models.

**What changed**

- Added a `useAgent` option for structured output when a separate structuring model is configured.
- Structured output now reuses the parent agent only when `useAgent: true` is set.
- Structured output now reads thread and resource IDs from request context instead of message list internals.

**Why**
This makes parent-agent reuse explicit and prevents separate structuring calls from inheriting memory unless the caller opts in.
