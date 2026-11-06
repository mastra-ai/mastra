---
'@mastra/core': patch
---

Fixed sub-agent delegation failing on Anthropic models with extended thinking when the supervisor delegates after calling another tool in the same run. Anthropic rejected these requests with "`thinking` or `redacted_thinking` blocks in the latest assistant message cannot be modified". Delegation already leaves the supervisor's tool calls out of the context it passes to the sub-agent; it now leaves out the supervisor's thinking too, so the request is accepted. The supervisor's text replies are still passed along. Fixes [#29276](https://github.com/mastra-ai/mastra/issues/29276).
