---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/deployer': minor
'mastra': minor
---

Added hosted source storage support for code-mode agent overrides.

Mastra can now connect code-source agent editing to a hosted source provider, including GitHub-backed file reads, writes, commit history, and server-side change request creation. Studio can open a pull request for an agent override without calling Platform directly, and hosted deployments can inject the Platform project and user context needed for that flow.
