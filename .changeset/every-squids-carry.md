---
'@mastra/core': patch
---

Fixed queued follow-up messages being saved without an answer after the active run is aborted.

- Pending signals wait for a fresh run instead of being consumed by an aborted run.
- Queued messages no longer inherit the previous run's cancellation signal. Explicit cancellation supplied for a queued message is preserved.
- Pending signals stay ahead of idle messages when preparation fails, including after cancellation of a queued startup.
- Forwarding signals to a new thread owner does not duplicate the same ID already waiting in that owner's pre-run or pending signal queue.
