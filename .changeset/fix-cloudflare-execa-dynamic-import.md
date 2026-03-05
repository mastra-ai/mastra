---
'@mastra/core': patch
---

Fixed Cloudflare Workers build failures when using `@mastra/core`. Local process execution now loads its runtime dependency lazily, preventing incompatible Node-only modules from being bundled during worker builds.
