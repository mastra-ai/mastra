---
'@mastra/server': minor
---

Added tool replay and tool mocking support to the experiment trigger API. `POST /datasets/:datasetId/experiments` now accepts a `toolReplay` option (`fromExperimentId`, `onMiss`, and a `matching` policy of `'fifo'` or `'strict'`) so experiments triggered over HTTP can replay recorded tool outputs instead of executing live tools, plus a `toolMocks` option for per-tool data mocks (a static `output`, an injected `error`, or an `expect` assertion on how the tool must be called). Function mocks are code-only and not accepted over HTTP — use `@mastra/core`'s `startExperiment` directly for those. Requests combining `toolReplay` or `toolMocks` with a non-agent target are rejected with a validation error at the API boundary instead of failing the experiment in the background.

Experiment result responses now include the dedicated `toolReplay` field carrying the replay divergence report (previously merged into `output`), so the report is no longer stripped from results returned over HTTP.
