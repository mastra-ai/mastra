---
'@mastra/core': patch
---

Fixed tools running with empty input (`{}`) when a provider streams a tool call without input deltas and only sends the arguments with the final tool call, for example OpenAI Responses or Anthropic programmatic tool calling. With eager tool execution (the `agent.stream()` default), the tool now waits for the complete tool call and receives the real arguments. Required inputs no longer fail validation because of the empty placeholder call.
