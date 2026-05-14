---
'@mastra/core': patch
---

Improved Harness v1 signal-run settlement.

- Signal-routed calls now wait for run output registration through `Agent.waitForRunOutput(runId)` instead of polling.
- Run completion has a single settlement path through `_waitUntilFinished()`, which keeps subscription delivery and completion promises aligned.
- `MastraModelOutput._waitUntilFinished()` now documents the ordering guarantee expected by tests and test doubles.
- Shared Harness v1 test helpers replace repeated fake-output setup and signal-envelope unwrapping across the test suite.
