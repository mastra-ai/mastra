---
'@mastra/client-js': patch
---

Added typed tool replay and tool mocking support to dataset experiment APIs.

`triggerDatasetExperiment` params now type the `toolReplay` option (`fromExperimentId`, `onMiss`, and a `matching` policy of `'fifo'` or `'strict'`), a `toolMocks` option for per-tool data mocks (a static `output`, an injected `error`, or an `expect` assertion on how the tool must be called), and the previously missing `versions` option. Function mocks are code-only and cannot cross the HTTP API — use `@mastra/core`'s `startExperiment` directly for those. Replay requires a server with tool replay support; older servers ignore the fields and run the experiment live.

`DatasetExperiment` now includes `name`, `description`, `skippedCount`, and `metadata` (experiments run with replay or mocks carry a `toolReplay` marker in metadata). `DatasetExperimentResult` now includes the top-level `toolReplay` field carrying the divergence report — the report lives in its own column and is no longer merged into `output`. The `ToolReplayReport` type is re-exported (along with `ToolReplayMatching`, `ToolMockConfig`, `ToolMockExpectation`, `ToolMockUsage`, and `ToolMockExpectationResult`) so consumers can read it from `result.toolReplay`.

Fixed `DatasetExperimentResult.error` to its actual shape: the server has always returned `{ message, stack?, code? } | null`, not a string. This lets typed consumers detect replay and mock failures via `error.code` (`TOOL_REPLAY_MISS`, `TOOL_REPLAY_NO_RECORDING`, `TOOL_REPLAY_LOAD_FAILED`, `TOOL_MOCK_EXPECTATION_FAILED`). Code that treated `error` as a string was already broken at runtime.
