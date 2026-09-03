---
'@mastra/factory': patch
---

A card's button now does exactly what dragging the card does: it moves the card, and the lane's rule decides which run starts there. The card moves as soon as you click and reports the run's state from the server, so a run started from a card is retried, superseded and reported like every other automated run instead of failing into a toast. The "X is ready" toast is gone; the session link arrives with the next poll.

Investigate on a Linear issue now lands in Triage, the lane its rule lives in, instead of Planning. Re-review on a Done-lane pull request re-enters Review and runs the re-review skill. Runs started from a card carry the issue or pull request number, the `gh pr checkout` step with the expected head branch, and the Linear fetch hint. A candidate's custom prompt is posted as a comment on the card it files, so the run reads it from the card's feed. A card in Done or Canceled offers its session instead of a lane; only a Done-lane pull request that is still open keeps Re-review.
