---
'@mastra/factory': minor
---

A Factory run waiting on any answer now surfaces instead of parking silently. The plan gate covered `submit_plan` only; a run that asked a question (`ask_user`) still stalled with the card saying Building. Any tool suspension on an unwatched run now lands in Needs attention as "Agent is waiting for an answer" — and auto-approved plans stay the only pause the Factory answers itself, because a question has no approvable default.
