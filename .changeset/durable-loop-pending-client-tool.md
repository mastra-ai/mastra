---
'@mastra/core': patch
---

Fixed the durable agent loop continuing past a client-executed tool call. A tool with no `execute` is answered by the client on a follow-up request, and the non-durable loop ends the turn at the call for that reason (`hasPendingHITL`). The durable mapping step had no such check: it recorded a result for the call it never got and ran the model again. It now leaves a pending client-side call unanswered and ends the turn, matching the non-durable loop.
