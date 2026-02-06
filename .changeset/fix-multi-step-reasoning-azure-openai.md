---
'@mastra/core': patch
---

Fixed multi-step tool calling with reasoning models to maintain proper message structure for Azure OpenAI compatibility.

When reasoning models (like OpenAI o1/o3) make multi-step tool calls, each step now remains a separate assistant message with its own reasoning + tool-call pair. Previously, these messages were incorrectly merged into a single message, causing Azure OpenAI to reject requests with validation error: "Item 'fc_...' of type 'function_call' was provided without its required preceding item of type 'reasoning'".

This fix ensures each tool call has its required preceding reasoning item in the same message, maintaining compatibility with Azure OpenAI's strict validation requirements.

Fixes #12775
