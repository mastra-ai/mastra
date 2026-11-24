---
'@mastra/inngest': patch
---

Fixed Inngest agents leaving `stopCause` off their `finish` chunk. The field now reaches both the `stream()` output and `subscribeToThread()` subscribers, as it does for other agents, so Studio no longer warns that an Inngest agent "reached maxSteps" after a run that stopped on a client tool or a `stopWhen` match.

Also fixed Inngest agents reporting `max_steps` instead of `stop_condition` when a `stopWhen` condition matched on the last allowed step. `stopWhen` now runs on that step too, before the step budget ends the run. If it throws there, the run still finishes with the completed step and reports `max_steps` instead of failing.
