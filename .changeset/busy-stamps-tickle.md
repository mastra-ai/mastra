---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `restart()` forking an evented workflow run that was still running on Postgres or libSQL. The restart now takes the run over: it claims each step it restarts before running anything, so the worker that was running the step can no longer save it, and the steps after it run once. Two `restart()` calls that race leave one owner per step, a restart event delivered twice no longer undoes progress, and a restart no longer overwrites results saved after it read the run or reopens a run that ended in the meantime.\\n\\n**Behavior change:** a step whose result was saved before the restart claimed it still keeps that result. A step whose save lands after the claim is now refused and runs again under the restart, as on the default engine after a takeover. Previously the late save won and the step did not run again. Other storage adapters are unchanged.
