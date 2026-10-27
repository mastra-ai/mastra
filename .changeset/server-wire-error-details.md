---
'@mastra/server': patch
---

Fixed agent-controller stream errors dropping the provider's status code, response body, request id and requested model when flattened for the wire. A live error now carries the same details as the error saved in thread history, so a client explains it the same way before and after a reload. Apps that don't save error parts now also receive these fields over the stream, where before only the error's name and message were sent. The response body is capped at 2,000 characters, and only the model name of the request sent to the provider reaches the wire.
