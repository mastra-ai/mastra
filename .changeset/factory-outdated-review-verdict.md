---
'@mastra/factory': patch
---

Fixed the Factory review verdict badge so it no longer shows an old approval as current after new commits are pushed. When a pull request or merge request gets a new head, its Review card and the Work card that opened it now show the previous verdict as outdated (for example `Approved · be10bfa (outdated)`) until the next review pass records a new one. The stored verdict is kept, so the next pass still runs as a re-review.
