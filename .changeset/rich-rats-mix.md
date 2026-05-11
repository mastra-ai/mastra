---
'@mastra/core': patch
---

Fixed agent requests to Anthropic failing with `400 unexpected tool_use_id` when recalled history contained an incomplete `tool_use` / `tool_result` pair. This most commonly hit agents using parallel tool calls when an earlier run was interrupted before every tool finished — pulling that broken exchange into a new prompt no longer crashes the next request.

Closes #16193
