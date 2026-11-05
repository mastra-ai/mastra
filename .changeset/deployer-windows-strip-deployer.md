---
'@mastra/deployer': patch
'@mastra/deployer-cloudflare': patch
---

Fixed `mastra build` on Windows failing with `We couldn't load "pnpapi"` when the project sets a deployer such as `CloudflareDeployer`. ([#29572](https://github.com/mastra-ai/mastra/issues/29572))
