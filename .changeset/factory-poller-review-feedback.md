---
'@mastra/factory': patch
---

Deliver GitHub review feedback to the factory rules on the polling path. Submitted reviews and new pull request comments were dropped before the rules engine ran, so the agent that authored a branch was never woken when a reviewer asked for changes.
