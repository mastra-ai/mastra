---
'@mastra/ai-sdk': patch
---

Support streaming agent text chunks from workflow-step-output

Adds support for streaming text and tool call chunks from agents running inside workflows via the workflow-step-output event. Workflows can now include agent stream chunks that are properly converted to UI messages.

Features:

- Added includeTextStreamParts option to WorkflowStreamToAISDKTransformer
- Added isMastraTextStreamChunk type guard to identify Mastra chunks
- Support for text-start, text-delta, text-end chunks
- Support for tool-call and tool-result chunks
- Comprehensive test coverage in transformers.test.ts
