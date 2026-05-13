---
'@mastra/core': patch
---

Harness v1 signal integration cleanup. `Session._watchRunCompletion` no longer microtask-polls for the run output handle — `Agent.waitForRunOutput(runId)` now returns an event-driven Promise that resolves the moment `registerRun` is called (or immediately if already registered). The subscription drain loop is now event-emission only; `_waitUntilFinished()` is the single canonical settlement path for `_runCompletionPromises`. `MastraModelOutput._waitUntilFinished()` gained an explicit doc-comment documenting its ordering guarantee for test doubles. New shared test helpers `buildFakeOutput` and `extractSignalContents` (in `harness/v1/__test-utils__`) replace hand-rolled fakes and inline signal-envelope unwrapping across the v1 test suite.
