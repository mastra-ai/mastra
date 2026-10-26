---
'@mastra/server': patch
---

Fixed agent-controller stream errors dropping the provider's status code, response body and request id when flattened for the wire. A live error now carries the same details as the error saved in thread history, so a client explains it the same way before and after a reload. The response body is capped at 2,000 characters, and the request sent to the provider never reaches the wire.
