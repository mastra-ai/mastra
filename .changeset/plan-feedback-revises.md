---
'@mastra/code-sdk': patch
---

Fixed plan feedback stopping the run. Sending feedback on a submitted plan now lets the agent revise the plan and submit it again, instead of ending with "Plan rejected by user". Rejecting a plan without feedback still stops the run and waits for your next message.
