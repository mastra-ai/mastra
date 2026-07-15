---
'@mastra/core': patch
---

Fixed approved tool calls corrupting a thread when the agent uses extended thinking. After you approved (or declined) a `requireApproval` tool call, the resumed turn was written back into the assistant message that was already saved when the run paused, instead of into a new message. With Anthropic extended thinking on, that reused message then failed validation on the next turn (`thinking blocks in the latest assistant message cannot be modified`) and the thread became permanently stuck. Resuming now starts a fresh assistant message for everything after the approval, so the saved message stays intact and the conversation continues normally.
