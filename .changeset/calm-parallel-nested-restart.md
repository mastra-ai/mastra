---
'@mastra/core': patch
---

Fixed boot-time recovery so nested workflows that already finished inside a parent `.parallel()` are reused instead of restarted. Parent `activeStepsPath` can still list completed children after a crash; restarting those terminal snapshots no longer throws "This workflow run was not active". As part of this, calling `restart()` on a run whose snapshot is already `success`, `failed`, or `tripwire` now returns the stored result without re-executing any steps (it previously threw). Fixes https://github.com/mastra-ai/mastra/issues/20225
