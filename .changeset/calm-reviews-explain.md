---
'@mastra/factory': patch
---

Pull request review status comments now say why a review attempt failed, without exposing private details. Alongside the existing label, the comment adds a short reason from a fixed list, for example `Agent run ended in error (the model provider rate-limited the run, HTTP 429)`, `Factory automation failed (a board rule threw an error)` or `Factory automation failed (StoredBoardError: TypeError)`. Reasons cover model provider failures, board rule rejections, Factory's own error classes and built-in JavaScript error types. The comment never includes error messages, provider responses, hostnames or IDs. Operators can read the sanitized error text, limited to 512 characters, on the Factory decision.
