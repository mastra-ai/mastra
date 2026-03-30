---
'@mastra/deployer-cloudflare': patch
---

Fixed Cloudflare Workers deploys that failed with `Could not resolve "readable-stream"`. Workers builds now resolve stream imports correctly without requiring extra stream polyfill packages.
