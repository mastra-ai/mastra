---
'@mastra/server': patch
---

Fix: the A2A `message/send` endpoint now accepts file and data message parts in addition to text. External A2A clients can attach files — either as URIs or base64-encoded bytes — and send structured data parts to a Mastra agent without hitting a JSON-RPC `-32602` invalid-params error. Unknown part kinds continue to return invalid-params, so strict validation is preserved.
