---
'@mastra/core': patch
---

Fixed infinite loop when LLM returns `finishReason: "tool-calls"` with no actual tool calls.

Some providers (e.g. Anthropic) can return `stop_reason: "tool_use"` with an empty `content` array. Previously, the agent loop treated this as a continuation signal, causing it to call the model repeatedly with the same messages until `maxSteps` was exhausted. The loop now correctly treats `finishReason: "tool-calls"` with no pending tool calls as equivalent to `"stop"`.
