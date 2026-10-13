---
'@mastra/core': patch
---

Fixed memory reconciliation discarding a server-computed toModelOutput mapping for client-executed tools (no server execute). When memory recalled the stored pending call, the reconciled result lost the cached projection and the next model prompt received the raw tool result instead of the mapped content. The server-computed mapping now survives reconciliation while other client-supplied part metadata remains dropped. Fixes #25744
