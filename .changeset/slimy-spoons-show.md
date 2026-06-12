---
'@mastra/client-js': patch
---

Added typed tool replay and tool mocking support to dataset experiment APIs.

`triggerDatasetExperiment` params now type the `toolReplay` option (`fromExperimentId`, `onMiss`, and a `matching` policy of `'fifo'` or `'strict'`), a `toolMocks` option for per-tool data mocks (a static `output`, an injected `error`, or an `expect` assertion on how the tool must be called), and the previously missing `versions` option. Function mocks are code-only and cannot cross the HTTP API — use `@mastra/core`'s `startExperiment` directly for those. Replay requires a server with tool replay support; older servers ignore the fields and run the experiment live.

`triggerDatasetExperiment` also accepts an `itemIds` option to run an experiment over a subset of dataset items (for example, re-running a single diverging item with replay), and the documented replay error codes now include `TOOL_REPLAY_UNCONSUMED` (strict matching: recorded tool calls left unconsumed fail the item).

`toolMocks` entries also type args-conditional answers: a `cases` table (the first case whose `args` match the call serves its `output` or `error`) with `onNoMatch` deciding unmatched calls — `'error'` (default) fails the item with `TOOL_MOCK_ARGS_MISMATCH`, `'passthrough'` runs the live tool — and the stamped experiment marker now carries `mockConfigs` (the mock configuration as configured: data mocks verbatim, function mocks as `{ function: true }`), with `ToolMockCase` and `ToolMockFunctionMarker` re-exported from `@mastra/core/datasets`.

`DatasetExperiment` now includes `name`, `description`, `skippedCount`, and `metadata` (experiments run with replay or mocks carry a `toolReplay` marker in metadata, and async experiments that fail during setup record why in `metadata.failureReason`). `DatasetExperimentResult` now includes the top-level `toolReplay` field carrying the divergence report — the report lives in its own column and is no longer merged into `output`. The full report and config vocabulary is re-exported from `@mastra/core/datasets` (`ToolReplayReport`, `ToolReplayCall`, `ToolReplayEvent`, `ToolReplayMiss`, `ToolReplayArgMismatch`, `ToolReplayMatching`, `ToolReplayExperimentMarker`, and the `ToolMock*` types), along with the `getToolReplayMarker` helper that safely reads the replay/mock marker from `experiment.metadata`.

Fixed the experiment response types to match what the server actually returns: `DatasetExperimentResult.scores` is now optional — the results endpoints carry no `scores` field, so code like `result.scores.map(...)` crashed at runtime — plus `expectedTrajectory` was added and `DatasetExperiment.agentVersion` is now optional. Compile-time drift detectors now also cover the experiment and result response types (and both directions of the trigger request body), so the hand-written types fail the build if the server schemas drift.

Fixed `DatasetExperimentResult.error` to its actual shape: the server has always returned `{ message, stack?, code? } | null`, not a string. This lets typed consumers detect replay and mock failures via `error.code` (`TOOL_REPLAY_MISS`, `TOOL_REPLAY_NO_RECORDING`, `TOOL_REPLAY_LOAD_FAILED`, `TOOL_REPLAY_UNCONSUMED`, `TOOL_MOCK_EXPECTATION_FAILED`). Code that treated `error` as a string was already broken at runtime.
