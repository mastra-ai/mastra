---
'@mastra/code-sdk': patch
---

Fixed ACP turns that an internal error ended returning `stopReason: "cancelled"` when the client never cancelled. `session/prompt` now returns a JSON-RPC error with the underlying message, so clients can tell a failure apart from a cancel.
