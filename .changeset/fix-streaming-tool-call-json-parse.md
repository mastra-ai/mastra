---
'@mastra/core': patch
---

Fixed streaming tool calls with large or complex JSON arguments intermittently failing to parse. When tool-call arguments arrived as streamed deltas, malformed JSON (trailing LLM tokens, trailing commas, missing quotes) was silently discarded, causing tools to receive empty input and triggering unnecessary retries. The streaming path now applies the same sanitization and repair that non-streaming tool calls already use.
