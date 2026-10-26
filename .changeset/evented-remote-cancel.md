---
'@mastra/core': patch
---

Fixed evented workflow runs that never finished after being cancelled from another Mastra instance (or after `startAsync()`). The run was marked `canceled` in storage, but the owner's `run.start()` never resolved and watchers never got a finish event. Cancelling now resolves `start()` with a `canceled` result, and the run emits a single `workflow.end`.

`run.cancel()` on an evented run now rejects if the cancel event can't be published. The run is only marked `canceled` once the cancel is published, so you can call `cancel()` again from any instance to retry.
