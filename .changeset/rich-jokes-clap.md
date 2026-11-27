---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed evented workflows and agents on Postgres and libSQL so that a run you resume or time travel stays protected against duplicate deliveries. A step delivered twice after a resume or time travel now saves one result and the steps after it run once, and a resume or time travel event delivered again no longer undoes the progress the run made since. A delivery that is dropped because another delivery of the same step already won now logs a warning.
