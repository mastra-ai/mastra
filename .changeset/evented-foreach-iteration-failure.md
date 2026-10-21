---
'@mastra/core': patch
---

Fixed evented `.foreach()` runs where more than one iteration fails. The run now keeps the first iteration's error instead of the last one, and fails exactly once. Previously, an iteration failing after the run had already failed replaced the stored error and published a second `workflow.fail`. Time-travel replays that hit a failure again also failed twice.
