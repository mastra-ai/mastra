---
'@mastra/deployer-cloudflare': patch
---

Fixed Cloudflare Workers exceeding the 3MB size limit due to TypeScript being bundled. The deployer now stubs out TypeScript (~10MB) since the agent-builder gracefully falls back to basic validation when it's unavailable.
