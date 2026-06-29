---
'mastra': patch
---

Remove premature deprecation warnings from `mastra server deploy` and `mastra studio deploy`. These commands continue to work and are not yet deprecated; the warning was added in advance of the unified `mastra deploy` rollout and surfaced before the replacement was generally available, which would have disrupted current users. They will be re-added once the unified deploy path is fully rolled out and the legacy paths are formally on the deprecation track.
