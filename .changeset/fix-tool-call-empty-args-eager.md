---
'@mastra/core': patch
---

Fixed tools running with empty input when using `agent.stream()`. Some providers, like OpenAI Responses and Anthropic programmatic tool calling, send tool arguments only at the end of a tool call. Tools now wait for the complete arguments before they run. Tools with required inputs no longer fail validation in this case.
