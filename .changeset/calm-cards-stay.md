---
'@mastra/factory': patch
---

Fixed agents looping on stale card moves. When an approved `factory_transition_work_item` arrived after other runs had already moved the card into the requested phase, it was rejected as stale and the agent kept retrying. It now succeeds as a no-op that reports the card's current phase and revision. A stale move into any other phase is still rejected with the revision to retry at.
