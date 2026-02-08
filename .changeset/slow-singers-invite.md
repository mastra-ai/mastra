---
'@mastra/ai-sdk': patch
---

Added sendReasoning and sendSources support to handleWorkflowStream and workflowRoute. Reasoning and source chunks from agents running inside workflows are now forwarded to the client when these options are enabled, matching the existing behavior of handleChatStream. Closes #12571.
