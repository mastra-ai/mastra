---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Add an explicit `useAgent` flag for separate structured output models.

**What changed**

- Added a `useAgent` option for structured output when a separate structuring model is configured.
- Structured output now reuses the parent agent only when `useAgent: true` is set.
- Structured output prefers thread and resource IDs from request context, but falls back to serialized message-list memory info when request context is not seeded.

**Why**
This makes parent-agent reuse explicit while still preserving expected read-only memory access for separate structuring calls that only provide `memory` options.
