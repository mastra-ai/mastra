---
'@mastra/playground-ui': patch
---

MCP Apps in Studio now get a JSON-RPC invalid-params error (`-32602`) when they call a tool the app's MCP server doesn't have or keeps for the model. That's the same error an MCP server gives for an unknown tool, so apps can spot a missing tool the same way whichever host they run in. Before, Studio threw a generic internal error.
