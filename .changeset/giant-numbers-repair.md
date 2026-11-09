---
'@mastra/deployer': patch
---

Improved `mastra build` speed. The build no longer re-parses the bundled server code to look for pino transports when the code has no pino transport call, which saves about a second per build on large projects.
