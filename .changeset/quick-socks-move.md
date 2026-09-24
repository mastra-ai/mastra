---
'@mastra/mongodb': patch
---

Fixed `listMessages` returning the wrong message when `include` names one that shares a `createdAt` with others. Messages are ordered by `(createdAt, id)`, but the lookup compared on `createdAt` alone, so it returned whichever id sorted highest and anchored the surrounding context window on that message. The forward half dropped later messages sharing the target's timestamp.

Semantic recall reaches this on every query, so a tie surfaced messages the search had not selected, with no error. Batched saves tie routinely.
