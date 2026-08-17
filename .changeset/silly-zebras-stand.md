---
'@mastra/core': patch
---

Fixed tool results being lost when an agent calls a server-side tool and a client-side tool in the same step. The server-side tool's result is now streamed to the client and saved to history before the agent hands control back for the pending client-side tool, so clients no longer wait forever on a tool call that already finished.
