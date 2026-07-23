---
'@mastra/factory': patch
---

Add a step recorder to `withProjectLock` so we can tell which platform call was in flight when a critical section runs long or times out. `fn` now receives a `LockStepRecorder` as its second argument; wrapping each named boundary (e.g. `fleet.resolveSandbox`, `sandbox.commitAll`, `github.getRepositoryAccess`, `sandbox.pushBranch`) captures start time, duration, and outcome. On timeout the recorded steps and the currently-running step are attached to `ProjectLockTimeoutError`. When a critical section completes but exceeds `MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS` (default 5s), a structured `warn` is emitted with the same breadcrumbs so platform-call regressions are visible before they cascade into a full timeout. All four GitHub route lock sites (commit / push / pr / sandbox teardown) are wired.
