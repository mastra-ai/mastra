---
'@mastra/core': patch
'@mastra/memory': patch
---

Prevented a cause of Anthropic rejecting a thread with "'thinking' or 'redacted_thinking' blocks in the latest assistant message cannot be modified" when observational memory is on. If an assistant message sealed by observational memory came back with its tool call resolved, the whole message, signed thinking included, was added again as a new message. Now the tool result is recorded on the existing message and only new content is added, so each thinking block reaches the model once. The resolved call is also saved even though the message is sealed, so it is still there on the next turn instead of reverting to pending. This stops new duplicates from being written. Threads that already hold a duplicated message will keep failing. Fixes #22802.
