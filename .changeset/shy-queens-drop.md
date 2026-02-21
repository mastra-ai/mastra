---
'@mastra/deployer-cloudflare': patch
---

Fixed D1Store REST API mode failing in Cloudflare Workers. The bundler now uses browser-compatible module resolution, ensuring packages like the Cloudflare SDK resolve to worker-friendly implementations instead of Node.js-specific code that depends on unavailable modules like 'https'.
