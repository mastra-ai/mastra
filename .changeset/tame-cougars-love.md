---
'@mastra/client-js': patch
'@mastra/core': patch
---

Fix delayed promises rejecting when stream suspends on tool-call-approval

When a stream ends in suspended state (e.g., requiring tool approval), the delayed promises like `toolResults`, `toolCalls`, `text`, etc. now resolve with partial results instead of rejecting with an error. This allows consumers to access data that was produced before the suspension.

Also improves generic type inference for `LLMStepResult` and related types throughout the streaming infrastructure.
