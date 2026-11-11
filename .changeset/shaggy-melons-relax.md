---
'@mastra/deployer-cloudflare': patch
---

Fixed Cloudflare Workers builds for projects with file-based agents. The build no longer fails while bundling the deployer, the Worker starts, and each request gets a Mastra instance with the file-based agents registered. Fixes [#29996](https://github.com/mastra-ai/mastra/issues/29996).
