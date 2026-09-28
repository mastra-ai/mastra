---
'@mastra/docker': patch
---

Fixed `wait()` reporting a killed or timed-out process as a natural exit. Terminating a process returned `kill() === true` while the resolved `CommandResult` omitted `killed`, so a forced termination was indistinguishable from a command that exited on its own.

Killing a process tears its own exec stream down, so Docker can deliver the stream's `end` event while `kill()` is still confirming the process group is gone. `end` settled `wait()` first — without `killed`/`timedOut` — and the exit code it recorded then prevented `close`, the only path that carried that metadata, from settling.

`end`, `close`, and `error` now settle through a single path, and `end` waits for an in-flight kill confirmation before settling. That wait is bounded, so a daemon that stops answering mid-kill cannot leave `wait()` pending; termination metadata is published by whichever event settles first.