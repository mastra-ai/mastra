---
'@mastra/memory': minor
'@mastra/code-sdk': patch
---

Subconscious now curates on its own instead of waiting to be asked.

`curationCadence` is removed. It counted committed observation runs, it was off by default, and it only ever fired on the synchronous observation path — so a host that enabled the subconscious and never called `Memory.runCuration` accumulated knowledge forever with nothing consolidating or pruning it, and nothing failed to signal the gap. This is breaking for anyone who set `curationCadence`; there is no shim.

In its place, two triggers the SDK evaluates itself, both **on by default**:

- `curationThreshold` — run the curator once this many knowledge updates have accumulated past the curation cursor. Defaults to `20`.
- `curationInterval` — run it once this many milliseconds have passed since the last completed curation, even if fewer updates are pending. Defaults to one hour.

Set either to `false` to disable that trigger. Elapsed time still bounds retries either way: after a curation that leaves the cursor where it found it, both triggers wait one interval (one hour when the time trigger is off) before trying again, so a curator that cannot make progress cannot spend model calls in a loop. `Memory.runCuration()` is unchanged and still available for hosts that want to curate at a specific moment, such as a work item changing phase.

Blast radius worth stating plainly: because the triggers are on by default, existing subconscious users will start making curation model calls they were not making before. A thread with no pending knowledge updates triggers nothing and costs nothing, no matter how much time passes. Each evaluation costs two bounded storage reads — the curation cursor and one page of pending updates — not the curator's paginated worklist.

The triggers fire on both knowledge-commit paths — synchronous observation and async-buffer activation — so clients using async buffering are covered too.

Factory sessions drop their `curationCadence: 3` override and take the defaults; their phase-exit `runCuration` call is unchanged.
