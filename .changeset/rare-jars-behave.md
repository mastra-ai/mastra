---
'@mastra/ai-sdk': patch
---

Fixed tool-call-suspended chunks being dropped in workflow-step-output when using AI SDK. Previously, when an agent inside a workflow step called a tool that got suspended, the tool-call-suspended chunk was not received on the frontend even though tool-input-available chunks were correctly received.

The issue occurred because tool-call-suspended was not included in the isMastraTextStreamChunk list, causing it to be filtered out in transformWorkflow. Now tool-call-suspended, tool-call-approval, object, and tripwire chunks are properly included in the text stream chunk list and will be transformed and passed through correctly.

Fixes #10978
