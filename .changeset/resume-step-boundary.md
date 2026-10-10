---
'@mastra/core': patch
---

Fixed saved agent steps after tool approval or stream resumption. After `approveToolCall`, `declineToolCall`, or `resumeStream`, each saved step now contains only its own content. Later steps no longer repeat earlier tool calls, so snapshots stay small and processors and `prepareStep` see the right content. Fixes #26475.
