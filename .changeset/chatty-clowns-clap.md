---
'@mastra/deployer': patch
---

Fixed deployer builds to preserve protocol-based runtime imports like `cloudflare:workers` without trying to install them as npm dependencies.
