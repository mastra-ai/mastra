---
"@mastra/ai-sdk": patch
---

Fix TypeScript overload resolution for `toAISdkStream()` with `WorkflowRunOutput`. The function was incorrectly rejecting `WorkflowRunOutput` types through `run.stream()` and `run.resumeStream()` due to improper union type ordering in the implementation signature. This fix reorders the union type to prioritize `WorkflowRunOutput` and adds runtime type detection to handle both `WorkflowRunOutput` and `MastraWorkflowStream` correctly, enabling proper type inference for both workflow stream types.
