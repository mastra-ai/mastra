---
'@mastra/core': patch
---

Fixed the type of targetResult in the onItemComplete callback for runEvals. The parameter was incorrectly typed as a Promise, but the actual value passed is already resolved. Users no longer need to await targetResult inside their callback.
