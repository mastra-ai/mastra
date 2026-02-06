---
"@mastra/ai-sdk": patch
---

Fixed `toAISdkStream()` so it accepts `WorkflowRunOutput` from `run.stream()` and `run.resumeStream()` without TypeScript errors. This improves type inference for workflow streams.
