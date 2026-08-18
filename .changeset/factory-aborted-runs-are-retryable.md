---
'@internal/mastra-factory': patch
---

Resume a skill run that was aborted out from under it.

An aborted run was recorded as a terminal failure on the assumption that an
abort is deliberate. In practice the dominant cause is the process going away
underneath the run — an operator restarting the server — and the run stream does
not say which happened. Cards were dead-ending at attempt 1 with nothing on the
board to press, needing a human to nudge each one by hand after every restart.

Aborted runs are now retried like any other interrupted work, still bounded by
the existing attempt cap.
