---
'@mastra/core': patch
---

Fixed harness handling for observational memory failures so streams stop immediately when OM reports a failed run or buffering cycle.

The harness now emits the existing OM failure event (`om_observation_failed`, `om_reflection_failed`, or `om_buffering_failed`), emits a top-level error with OM context, and aborts the active stream. This prevents normal assistant output from continuing after an OM model failure.
