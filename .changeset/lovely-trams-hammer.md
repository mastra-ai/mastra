---
'@mastra/ai-sdk': patch
---

Fixed AI SDK v6 native tool approvals resuming the wrong tool call. When multiple tool calls were awaiting approval, approving one could execute a different one. The approval response now carries the answered tool call's ID through to the resume, so the approved tool call is the one that runs.
