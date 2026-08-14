---
'@mastra/core': minor
'@mastra/platform-workspace': patch
'@mastra/factory': patch
'@mastra/railway': patch
---

Added checkpoint support to LocalSandbox and a checkpoint capability signal to sandboxes. Sandboxes now expose `supportsCheckpoints` so features can detect whether `snapshot()` persists real state. LocalSandbox gained filesystem-backed checkpoints: pass `checkpointName` to seed the working directory on `start()` and persist it on `snapshot()`, and `seedCheckpointName` as a boot-only fallback (for example a shared warm base image) that never gets overwritten by later snapshots.
