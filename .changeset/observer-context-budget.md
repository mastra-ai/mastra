---
'@mastra/memory': patch
---

Fixed `observation.previousObserverTokens` being ignored. Setting a budget now limits Observer calls to the most recent previous observations that fit it, on every observation path, and the Observer is told when its context was truncated. `previousObserverTokens: 0` omits previous observations. The default is now `false`, which sends the full previous observations. That matches how Observer calls have behaved since the budget stopped being applied, so nothing changes unless you set a budget. Stored memory is unaffected: new observations are still appended to the full observation text.
