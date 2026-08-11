---
'@mastra/factory': patch
---

Fixed sandbox checkpoints only being captured at session teardown. Factory sessions now snapshot the workspace sandbox at the end of every agent turn, so sandboxes that are reclaimed while idle can be restored from a checkpoint that includes the last completed turn's changes.
