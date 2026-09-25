---
'@mastra/mongodb': patch
---

Fixed semantic recall returning a message the search had not selected, along with the wrong surrounding context, when several messages share a timestamp.

Messages are ordered by `(createdAt, id)`, but `listMessages` resolved the message named by `include` on `createdAt` alone. Saving messages in one batch gives them the same timestamp routinely, so this was reachable on any query and failed with no error.
