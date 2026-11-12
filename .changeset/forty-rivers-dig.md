---
'@mastra/code-sdk': patch
---

Background shells stopped through the sandbox's process manager, for example by a host's HTTP kill route, no longer send the agent an exit notice. Shells stopped with `kill_process` or from the activity list already sent none.
