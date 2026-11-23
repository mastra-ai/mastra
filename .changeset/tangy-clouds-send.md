---
'@mastra/core': patch
---

Fixed evented workflows recording a finished `.sleep()` or `.sleepUntil()` step as `waiting` with no output. The step is now saved as `success` with the data it passed on, like the default engine, so `run.timeTravel()` to the step after a sleep receives the right input instead of `{}`. When the sleep's timer fires on a run that is already canceled, the sleep is left unfinished and sends no finish events. A cancel that lands while the timer callback is saving the result can still record the sleep as finished. See [#30008](https://github.com/mastra-ai/mastra/issues/30008).
