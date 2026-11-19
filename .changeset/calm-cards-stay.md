---
'@mastra/factory': patch
---

Fixed agents looping on stale card moves. When an approved `factory_transition_work_item` arrived after other runs had already moved the card into the requested phase, it was rejected as stale and the agent kept retrying. It is now evaluated once more against the card as it is. It succeeds as a same-phase move, or is rejected for a real reason such as a board policy. If the card changes again during that attempt, the move is rejected as stale with the newer revision. A stale move into any other phase is still rejected with the revision to retry at.
