---
'@mastra/memory': patch
---

Fixed `observation.previousObserverTokens` being ignored. Observer calls again receive only the most recent previous observations that fit the budget (40,000 tokens by default) instead of the full observation history, so very large threads send smaller Observer requests. Set a lower budget to cut Observer input further. `previousObserverTokens: 0` omits previous observations, `false` sends all of them, and the Observer is told when its context was truncated. Stored memory is unaffected: new observations are still appended to the full observation text.
