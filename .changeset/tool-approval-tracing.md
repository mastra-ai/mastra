---
'@mastra/observability': minor
---

Add tool approval tracing to spans for debugging

Added the ability to see tool approval requests in traces for debugging purposes. When a tool requires approval, a `MODEL_CHUNK` span named `chunk: 'tool-call-approval'` is now created containing:
- The tool call ID and name for identification
- The arguments that need approval
- The resume schema defining the approval response format

This enables users to debug their system by seeing approval requests in traces, making it easier to understand the flow of tool approvals and their payloads.