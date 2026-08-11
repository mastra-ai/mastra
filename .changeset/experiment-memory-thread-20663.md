---
'@mastra/core': patch
---

Fixed dataset experiment runs failing with a missing-thread memory error when the target agent has memory configured and the request context provides only a resource id (for example from auth middleware or Studio). Each dataset item now runs in its own fresh memory thread; explicitly supplied thread ids are still respected. Fixes #20663
