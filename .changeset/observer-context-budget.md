---
'@mastra/memory': patch
---

Fixed `observation.previousObserverTokens` being ignored. Observer calls again receive only the most recent previous observations that fit the budget (2,000 tokens by default) instead of the full observation history. Large threads therefore send much smaller Observer requests. `previousObserverTokens: 0` omits previous observations, `false` sends all of them, and the Observer is told when its context was truncated. Stored memory is unaffected: new observations are still appended to the full observation text.
