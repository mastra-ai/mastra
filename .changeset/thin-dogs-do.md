---
'@mastra/core': minor
---

Added iteration history for dountil/dowhile loops. Each loop iteration's output, status, and timing are now preserved in `metadata.iterations` on the step result, making it possible to inspect or time-travel to any past iteration without manually reconstructing state.
