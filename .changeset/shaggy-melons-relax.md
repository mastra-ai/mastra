---
'@mastra/deployer-cloudflare': patch
---

Fixed Cloudflare Workers builds for projects with file-based agents. The build no longer fails while bundling the deployer, the Worker starts, and the agents are available in the Worker. File-based agents in a Worker don't get the default workspace, because Workers have no local filesystem. Fixes [#29996](https://github.com/mastra-ai/mastra/issues/29996).
