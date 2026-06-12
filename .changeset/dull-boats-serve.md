---
'@mastra/server': minor
---

Added tool replay and tool mocking support to the experiment trigger API. `POST /datasets/:datasetId/experiments` now accepts a `toolReplay` option (`fromExperimentId`, `onMiss`, and a `matching` policy of `'fifo'` or `'strict'`) so experiments triggered over HTTP can replay recorded tool outputs instead of executing live tools, plus a `toolMocks` option for per-tool data mocks (a static `output`, an injected `error`, or an `expect` assertion on how the tool must be called). Function mocks are code-only and not accepted over HTTP — use `@mastra/core`'s `startExperiment` directly for those. Requests combining `toolReplay` or `toolMocks` with a non-agent target are rejected with a validation error at the API boundary instead of failing the experiment in the background.

The trigger API also accepts an `itemIds` option to run an experiment over a subset of dataset items (for example, re-running a single diverging item) instead of the whole dataset.

`toolMocks` entries can also answer conditionally on the call's arguments via a `cases` table: the first case whose `args` match serves its `output` or throws its `error`, and `onNoMatch` decides unmatched calls — `'error'` (default) fails the item deterministically with `TOOL_MOCK_ARGS_MISMATCH`, `'passthrough'` runs the live tool. The API rejects `cases` combined with a static `output`/`error`, empty `cases` arrays, and cases that answer with neither an output nor an error.

Experiment result responses now include the dedicated `toolReplay` field carrying the replay divergence report (previously merged into `output`), so the report is no longer stripped from results returned over HTTP.

The trigger route also validates more before answering: `toolMocks` entries whose keys normalize to the same tool name (for example `my.tool` and `my_tool`) and malformed `toolReplay`, `toolMocks`, or `itemIds` values are rejected with a 400 up front instead of the experiment failing later in the background. When an async experiment still fails during setup (for example a `toolReplay.fromExperimentId` that does not exist), the reason is now readable over HTTP: the experiment record carries `metadata.failureReason` (`{id, message}`) alongside its `failed` status.
