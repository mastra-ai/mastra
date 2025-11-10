---
'@mastra/core': patch
---

Fix agent network iteration counter bug causing infinite loops

The iteration counter in agent networks was stuck at 0 due to a faulty ternary operator that treated 0 as falsy. This prevented `maxSteps` from working correctly, causing infinite loops when the routing agent kept selecting primitives instead of returning "none".

**Changes:**
- Fixed iteration counter logic in `loop/network/index.ts` from `(inputData.iteration ? inputData.iteration : -1) + 1` to `(inputData.iteration ?? -1) + 1`
- Changed initial iteration value from `0` to `-1` so first iteration correctly starts at 0
- Added `checkIterations()` helper to validate iteration counting in all network tests

Fixes #9314
