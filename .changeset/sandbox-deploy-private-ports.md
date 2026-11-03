---
'@mastra/deployer-sandbox': patch
---

Fixed sandbox deploys reporting a healthy server when the sandbox's port was private. The health check no longer counts a response that the sandbox's preview sends itself, such as a sign-in request, as the Mastra server answering.
