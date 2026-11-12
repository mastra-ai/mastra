---
'@mastra/core': patch
---

Fixed plain `agent.stream()` and `agent.generate()` waiting out a server-cache (for example Redis) outage before the run starts, and kept a slow cache from turning a run into a refusal it did not need.

A run id the caller did not name cannot be held by any other run, so it no longer reads the run record at all: a generated-id run starts immediately even while the cache is paused, partitioned, or holding commands offline. The in-process claim still runs for every id, so a `generateId` that hands one id out twice is still refused with `AGENT_RUN_ID_ALREADY_CLAIMED`.

An id the caller named, and a resume, still read the shared record. That read now gives up after 5 seconds and refuses the run with `AGENT_RUN_RECORD_UNAVAILABLE`; a failed read returns the same error with the original cache error attached as its cause. A refused run starts nothing: it opens no trace span and leaves the output processors a suspended run is holding in place, so the retry the error asks for still resumes with them.

Starting a run now also claims its id in this process before the last await that separates the ownership check from the run's publisher. Two callers reusing one id at the same time could previously both be admitted, both publish on the run's topic, and the second would overwrite the first's ownership record. The claim is released when admission fails, when clearing a finished run's log fails, and once the publisher is created.

The events a run publishes for other readers are queued behind one another, so during an outage that backlog grew for as long as the outage lasted. The queue is now bounded at 256 events and 8 MiB of payload. Past that, the copy published for other readers is dropped rather than queued: the caller's own stream is unaffected, because publishing only mirrors it. A run that had to drop events reports `AGENT_STREAM_REPLAY_INCOMPLETE` on its stream before it can report success, so `observe()` and clients replaying the log get an explicit failure instead of a transcript that silently stops early; if that report cannot be published, the run ends with the error rather than a success. This bound covers the events the publisher holds, not the run's whole memory, and while the transport itself is unreachable neither the report nor its fallback can be delivered.
