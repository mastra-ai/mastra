---
'@mastra/server': patch
---

The session state endpoint now reports `stateVersion` and `stateEpoch`, the server's own ordering stamp for the snapshot, so UIs can merge it against stamped run events without relying on arrival order.
