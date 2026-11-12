---
'@mastra/core': patch
---

Fixed tool calls released by a permission rule after a session reopens failing with "the request has no authenticated user". When a reopened session allowed a call that was waiting for approval, the run resumed without the reopening request's context, so hosts that check the signed-in user before resolving model credentials refused the next model step. The resumed run now carries the request context the session was opened with.
