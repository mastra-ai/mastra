---
'mastra': patch
---

Studio: a workflow run suspended on human input no longer counts that wait as run time. The run duration stops at the moment it suspended and a separate clock, next to the Suspended badge, shows how long the run has been waiting for input. Suspended steps show the time they actually ran before suspending instead of a dash, and a nested workflow waiting on its child now reads "Needs input" rather than showing a running spinner. Once resumed, the run duration is wall clock again and says so on hover: the engine drops the suspension timestamp on resume, so the time spent waiting cannot be subtracted after the fact.
