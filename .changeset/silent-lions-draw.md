---
'@mastra/core': patch
---

Fixed `dataset.startExperiment` for workflow targets to match `runEvals`. Previously, scorers running inside a persisted experiment could not access per-step input or output, `requestContext` configured on the experiment was not forwarded into the workflow run, and direct agent calls inside workflow steps could start detached traces instead of nesting under the workflow step span. Step-level data is now exposed to scorers via `run.targetMetadata.stepResults` and `run.targetMetadata.stepExecutionPath`, the workflow's root span ID is available as `run.targetSpanId`, `requestContext` propagates into every step, and ambient workflow step tracing is used when creating nested spans. Fixes [#15613](https://github.com/mastra-ai/mastra/issues/15613).
