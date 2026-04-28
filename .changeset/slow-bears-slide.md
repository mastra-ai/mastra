---
'@mastra/core': patch
---

Fixed tool call failures caused by LLMs hallucinating empty `resumeData: {}` and stale `suspendedToolRunId` parameters when calling workflow tools. Empty resume data objects are now normalized to `undefined`, preventing fresh tool calls from incorrectly taking the resume path. This fixes "Failed workflow tool execution" errors that occurred when agents called workflow tools multiple times in a conversation.
