---
'@mastra/core': patch
---

Fixed a new thread subscription replaying a run that was already stopped. Aborting a run and opening another subscription on the same thread no longer emits a second `agent_start` or a duplicate terminal event, and the follow-up message that opened the subscription is delivered instead of stalling behind the stopped run. Resumed and later runs stream as before. Fixes #24174
