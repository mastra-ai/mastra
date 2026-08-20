---
'@mastra/factory': patch
---

Fixed pull request cards that stayed marked as open after an approving review. A card that an approving review moved to `done` was dropped from the GitHub reconcile sweep, so a merge landing afterwards never reached it — the board card kept saying `open` and the merged marker never appeared on its review session in the sidebar. Cards now stay in the sweep until their pull request is actually closed.
