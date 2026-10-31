---
'@mastra/mcp': patch
---

Fixed `MCPServer` rejecting calls to tools it had just listed when fine-grained authorization is configured. A policy that allowed a user to run a server's tools, directly or through the server's `fga` mapping, still denied every call, because each call was checked a second time against the plain tool name. Calls are now checked only against the server's own rule, including when the server's tools are given to an agent. Fixes #28787.
