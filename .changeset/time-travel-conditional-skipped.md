---
'@mastra/core': patch
---

Report an unrecorded conditional arm as skipped when time-travelling past it, instead of persisting it as a successful step with an empty output. Preserve caller-supplied replacement output for a recorded failed arm.
