---
'@mastra/factory': patch
---

Pull request review status comments now say why a review attempt failed, without exposing private details. Alongside the existing label, the comment adds a short reason from a fixed list, for example `Agent run ended in error (the model provider rate-limited the run, HTTP 429)`, `Factory automation failed (a board rule threw an error)` or `Factory automation failed (StoredBoardError: a network connection was refused)`. Reasons cover model provider failures, board rule rejections, Factory's own error classes, network and file system error codes, and common Postgres errors. The comment never includes error messages, provider responses, hostnames or IDs. The full error is still stored on the Factory decision for operators.
