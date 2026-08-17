---
'@internal/factory-ui': patch
---

Make the board honest about runs it is waiting on, and about clicks that fail.

Four gaps closed on the work board:

- A card click that failed while refreshing workspaces before starting a run did
  nothing at all — no run, no error. It now surfaces the failure instead of
  swallowing it, so an expired session reads as an expired session.
- A run a rule proposed could not be approved from the card. The card menu now
  offers it.
- After a plan was approved, the Building run became unreachable from the card,
  leaving the item stranded mid-loop.
- A card with a proposed run looked idle. It now says it is waiting on someone,
  with the approval inline.
