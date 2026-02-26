---
'@mastra/core': patch
---

Fixed multi-step tool calling with reasoning models to maintain proper message structure for Azure OpenAI compatibility.

When reasoning models make multi-step tool calls, each step now remains a separate assistant message with its own reasoning + tool-call pair. Previously, these messages were incorrectly merged into a single message, breaking Azure OpenAI's strict validation that requires each function_call to have a preceding reasoning item.
