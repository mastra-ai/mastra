---
'@mastra/code-sdk': patch
---

Fixed plan feedback ending the run. When a rejected `submit_plan` carries the user's feedback, the agent now revises the plan and resubmits it in the same run. A rejection without feedback still stops the run until the user sends their next message.
