---
'@mastra/factory': patch
---

Fixed agents looping on stale card moves. When an approved `factory_transition_work_item` arrived after other runs had already moved the card into the requested phase, it was rejected as stale and the agent kept retrying. It is now evaluated once more against the card as it is, so it succeeds as a same-phase move (or is rejected for a real reason, such as a board policy). A stale move into any other phase is still rejected with the revision to retry at.
