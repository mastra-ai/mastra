---
'@mastra/mcp': patch
---

Fixed `MCPServer` denying calls to tools it had just listed when fine-grained authorization is configured. Calls now succeed whenever the policy allows the user to run the server's tools, including through the server's `fga` mapping. The same rule applies when the server's tools are given to an agent. Fixes #28787.
