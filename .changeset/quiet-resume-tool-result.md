---
'@mastra/client-js': patch
---

Fixed `approveToolCall`, `declineToolCall`, and `resumeStream` logging `tool_result must be preceded by a tool_call` on every resume. Client tools the model calls after a resumed tool call now run as expected.
