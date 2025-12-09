---
'@mastra/agent-builder': patch
---

Fix install step validation error by making targetPath optional in InstallInputSchema. This resolves the "expected string, received undefined" error when running the agent builder template workflow without explicitly providing a targetPath parameter.
