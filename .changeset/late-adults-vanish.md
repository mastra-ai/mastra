---
'@mastra/ai-sdk': patch
---

Added initialState support to handleWorkflowStream in @mastra/ai-sdk. Previously, the WorkflowStreamHandlerParams type was missing the initialState property, preventing users from initializing global workflow state when using handleWorkflowStream.
