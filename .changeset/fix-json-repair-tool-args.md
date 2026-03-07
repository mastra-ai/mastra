---
'@mastra/core': patch
---

Fix tool calls with malformed JSON arguments from certain LLM providers silently failing.

- Auto-repair for trailing LLM tokens, unquoted keys, single quotes, missing quotes, and trailing commas
- Unrepairable JSON now returns a `parseError` so the model can self-correct
- New `repairToolCall` hook on agent execution for custom repair logic
