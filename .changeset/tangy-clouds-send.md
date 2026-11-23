---
'@mastra/core': patch
---

Fixed evented workflows recording a finished `.sleep()` or `.sleepUntil()` step as `waiting` with no output. The step is now saved as `success` with the data it passed on, like the default engine, so `run.timeTravel()` to the step after a sleep receives the right input instead of `{}`. When the sleep's timer fires on a run that is already canceled, the sleep is left unfinished and sends no finish events. A cancel that lands after the timer fires but before the result is saved can still record the sleep as finished and send its finish events. Saving the finished sleep now happens in normal event handling, so a storage error there is retried like any other step's save instead of leaving the run `waiting`. With `perStep: true`, a run now pauses after a sleep, as it does after any other step. See [#30008](https://github.com/mastra-ai/mastra/issues/30008).
