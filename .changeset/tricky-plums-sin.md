---
'@mastra/core': patch
---

Fixed `resume()` streaming nothing and never finishing after a durable agent run suspended. With observational memory on, the resumed run also failed its memory step with "lost its execution lease". Fixes [#30206](https://github.com/mastra-ai/mastra/issues/30206).

This happened with storage that tracks which execution owns a run, most often when storage is slow to open new connections. A lease renewal sent just before the run suspended reached storage after the run had let go of it, and the run was reported as lost. Evented agent runs were affected too, including when the worker runs in a different process from the API. A late renewal is now ignored when storage shows the run's own suspension or finish caused it to fail. A renewal rejected because another execution took over the run still stops the run.

**Behaviour changes**

- With storage that does not track run ownership, a late renewal after a run suspends still reports the run as lost, as before.
- When an evented worker finished or suspended a run but the result never reached the caller, the caller now gets the loss error: the first failed lease renewal after the release is excused and the next one reports the loss, so it arrives within about two lease-renewal intervals (10s). Before, it never got one when the worker and caller shared a process, and got it up to one interval (5s) earlier when the worker ran in another process. A run abandoned by a worker in another process is also reported up to 5s later. A run abandoned in this process is reported as before.
- With storage that tracks run ownership, an execution that outlives its claim's release (for example a worker still running after the run suspended) keeps publishing for up to one lease-renewal interval longer before its events are dropped.
