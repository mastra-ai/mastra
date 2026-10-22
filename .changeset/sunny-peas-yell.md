---
'@mastra/inngest': patch
---

Stop detached Inngest until-idle schedulers on explicit run or thread abort so background completion cannot start another turn.
