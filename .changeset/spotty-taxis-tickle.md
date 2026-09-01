---
'@mastra/core': patch
---

Record TripWire aborts on workflow-path PROCESSOR_RUN spans as span errors with the structured `tripwireAbort` attribute (reason, retry, metadata), matching the legacy processor-runner path. Previously these spans ended like successful runs with only `output.tripwire`, dropping the retry flag and error info.
