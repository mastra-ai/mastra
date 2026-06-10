---
'@mastra/client-js': patch
---

Added typed tool replay support to dataset experiment APIs.

`triggerDatasetExperiment` params now type the `toolReplay` option (`fromExperimentId`, `onMiss`) and the previously missing `versions` option. Replay requires a server with tool replay support; older servers ignore the field and run the experiment live.

`DatasetExperiment` now includes `name`, `description`, `skippedCount`, and `metadata` (experiments run with replay carry a `toolReplay` marker in metadata). The `ToolReplayReport` type is re-exported so consumers can read the divergence report from `result.output.toolReplay`.

Fixed `DatasetExperimentResult.error` to its actual shape: the server has always returned `{ message, stack?, code? } | null`, not a string. This lets typed consumers detect replay failures via `error.code` (`TOOL_REPLAY_MISS`, `TOOL_REPLAY_NO_RECORDING`, `TOOL_REPLAY_LOAD_FAILED`). Code that treated `error` as a string was already broken at runtime.
