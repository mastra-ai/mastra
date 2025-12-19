---
"@mastra/observability": patch
---

fix(tracing): reuse model_step span to preserve correct start time

Ensures that when a `model_step` span already exists, the existing span is reused and updated with metadata from the `step-start` payload instead of creating a new span. This preserves the original `startTime` so the span correctly reflects the full duration of the step.

Fixes #11271