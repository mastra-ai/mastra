---
"@mastra/deployer-cloudflare": minor
---

Add support for configuring Cloudflare Workers assets via CloudflareDeployer. Introduces a new `CFAssets` interface with typed configuration options (directory, binding, run_worker_first, html_handling, not_found_handling) that aligns with the official Wrangler schema. The assets configuration is now forwarded to the generated wrangler.json, enabling users to serve static assets such as SPA builds using Cloudflare Workers Assets.
