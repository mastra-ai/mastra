---
'@mastra/core': patch
---

Fixed evented workflows recording a finished `.sleep()` or `.sleepUntil()` step as `waiting` with no output. The step is now saved as `success` with the data it passed on, like the default engine, so `run.timeTravel()` to the step after a sleep receives the right input instead of `{}`. When the sleep's timer fires on a run that is already canceled, the sleep is left unfinished and sends no finish events. A cancel that lands after the timer fires but before the result is saved can still record the sleep as finished and send its finish events. If storage fails when the sleep's timer fires, the run now fails with that error instead of staying `waiting` forever. See [#30008](https://github.com/mastra-ai/mastra/issues/30008).
