---
'@mastra/core': patch
---

Fixed `runEvals` failing to persist trajectory and step scorer results. The internal score validation schema rejected the `entityType` values `TRAJECTORY` and `STEP` that the runner emits, so scores were computed but silently dropped before reaching storage. Trajectory and step scorer results now persist correctly and appear in Studio's observability section.
