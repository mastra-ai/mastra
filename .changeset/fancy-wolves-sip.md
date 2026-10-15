---
'@mastra/deployer-cloudflare': patch
---

Fixed Cloudflare builds failing with `Could not resolve "@opentelemetry/api"` after `posthog-node` 5.56.1 started importing that optional package. When your project doesn't install `@opentelemetry/api`, the generated Wrangler config now points it at a stub, so `wrangler dev` and `wrangler deploy` work again. Fixes #27037.
