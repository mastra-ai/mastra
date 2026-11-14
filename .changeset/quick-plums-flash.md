---
'@mastra/core': patch
---

Fixed `run.restart()` running a step again when the workflow run finished or suspended after `restart()` read it but before `restart()` took it over from the process running it. Restarting a run that finished now returns its stored result, and restarting a run that suspended fails with the usual "This workflow run was not active" error.
