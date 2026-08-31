---
'@mastra/factory': minor
---

A Factory run waiting on any answer now surfaces instead of parking silently.

**Fixed: questions stalled the same way plans used to**

The plan gate covered `submit_plan` only. A run that asked a question through `ask_user` still stalled with the card saying Building. Any tool suspension on an unattended run now lands in Needs attention as "Agent is waiting for an answer".

**Unchanged: pauses that belong to a person**

Person-started runs are untouched — their pauses wait for the person reading them. Auto-approved plans stay the only pause the Factory answers itself, because a question has no approvable default.
