---
'@mastra/core': patch
---

Fixed follow-up messages getting stuck after a tool suspends on an agent with `autoResumeSuspendedTools` enabled. A message sent with `agent.sendMessage()` (as Studio does once a chat exists) now starts the next turn, so the suspended tool or workflow resumes with the user's answer and the agent replies. Before, the message was accepted but never ran. Fixes [#30190](https://github.com/mastra-ai/mastra/issues/30190).

If another server process that shares the thread resumed the run, the process running the run answers the message once, whichever process it was sent to. On Inngest agents, approving a tool with only `runId` and `toolCallId` now lets a message queued behind the approval run once a tool that waits for input suspends afterwards.
