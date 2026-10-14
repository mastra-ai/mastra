---
'@mastra/core': minor
---

Knowledge can take an optional (sync or async) `vouch` callback that supplies host-trusted scope parameters (for example a project id) when a scope template needs one the run did not provide. A vouched scope only anchors the run; it never grants the caller ownership of that scope.
