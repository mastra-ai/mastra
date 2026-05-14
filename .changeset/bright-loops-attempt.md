---
'@mastra/core': patch
---

Refactored the internal background-task workflow into a nested workflow of `run-attempt` and `classify-outcome` steps inside a `dountil` loop. Each retry attempt is now an observable workflow step in run history and event traces, replacing the prior single-step body that hid retries inside an internal for-loop. No public API or behavior changes.
