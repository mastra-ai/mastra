---
'@mastra/core': patch
---

Stop a second attempt to resume the same suspended agent run from surfacing `AGENT_RESUME_ALREADY_CLAIMED` as a session error or restoring the parked prompt: one continuation drives the parked call and the other steps aside.
