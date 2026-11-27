---
'@mastra/core': patch
---

Fixed `restart()` forking an evented workflow run that was still running on Postgres or libSQL. The restart now takes the run over: it claims each step it restarts before running anything, so the worker that was running the step can no longer save it, and the steps after it run once, also when two `restart()` calls race. A restart event delivered twice no longer undoes progress, and a restart no longer overwrites results saved after it read the run. A restart that applies after the run ended or suspended leaves the run as it was, and `restart()` returns the stored result instead of waiting.

**Behavior change:** a step whose result was saved before the restart claimed it still keeps that result. A step whose save lands after the claim is now refused and runs again under the restart, as on the default engine after a takeover. Previously the late save won and the step did not run again.

**Not covered:** steps a restart can't claim, such as `foreach` items, sleeps and step records written before step guards existed, can still run under both the old worker and the restart, and two restarts before the first step can both run it. With `storageVersion: 2`, the old worker's copy of a step can still save while the restart's copy runs, and a copy delivered later can run the step again. Other storage adapters are unchanged.
