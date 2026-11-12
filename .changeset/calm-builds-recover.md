---
'@mastra/factory': patch
---

Fixed environment templates that could stop rebuilding for good. When a build start was never recorded and the sandbox provider can't list its builds (Mastra Platform), every later Build now, schedule and push run used to skip with `unresolved` forever. Factory now treats that start as failed 30 minutes after its lease lapsed and the next trigger builds.

Saving a change to a template input (setup commands, the working directory, settings, environment repositories, source-control connections or Build variables) now rebuilds the template once the project has one, so new sandboxes stop rerunning setup on every boot. Saves that change nothing don't build, and a change saved during any build, scheduled ones included, is built when that build ends.
