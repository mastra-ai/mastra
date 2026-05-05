---
'@mastra/core': patch
---

Fixed agent crashing on Anthropic with `messages.N.content.0: unexpected tool_use_id` when SemanticRecall (or any recall window) returned a partial parallel tool-call group. The conversion path now drops orphan `tool_use` / `tool_result` blocks before sending to the LLM, so a recalled exchange that lost half its pair no longer poisons the next request.

Closes #16193
