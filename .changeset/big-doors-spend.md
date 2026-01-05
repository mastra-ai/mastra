---
'@mastra/core': patch
---

Fix message IDs missing in onFinish callback response.messages

- Updated `AIV5ResponseMessage` type to include required `id` field to match AI SDK's `ResponseMessage` type
- Modified `aiV5UIMessagesToAIV5ModelMessages` to preserve message IDs from UIMessages after `convertToModelMessages` strips them

Fixes #11615
