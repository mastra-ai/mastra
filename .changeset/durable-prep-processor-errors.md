---
'@mastra/core': patch
---

Fixed durable agents silently ignoring input processor errors. A processor that throws (other than a tripwire) now fails the run, matching regular agents, instead of letting unprocessed input reach the model.
