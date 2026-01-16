---
'@mastra/braintrust': patch
---

Fix Thread view truncation in Braintrust when LLM generations include tool calls.

The Braintrust exporter now reconstructs LLM output in OpenAI Chat Completion format by examining child `MODEL_STEP` and `TOOL_CALL` spans. This enables Braintrust's Thread view to properly display the full conversation flow including tool calls and their results.
