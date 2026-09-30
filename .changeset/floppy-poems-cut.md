---
'@mastra/factory': patch
---

Fixed Factory source-control artifacts to use a stable provider identity while recording the human actor or automation trigger for traceability. Factory also sends deterministic retry keys for brokered GitHub writes so timeouts cannot create duplicate pull requests, comments, reviews, or merges during the supported retry window. This does not change authentication or authorization.
