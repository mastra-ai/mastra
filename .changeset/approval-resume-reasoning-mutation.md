---
'@mastra/core': patch
---

Fixed conversations becoming permanently stuck after approving or declining a `requireApproval` tool call with Anthropic extended thinking enabled. Resuming now saves the model's continuation in a new assistant message, so the paused response stays intact and later turns keep working.
