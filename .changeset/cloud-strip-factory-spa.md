---
'@mastra/deployer-cloud': patch
---

`bundle()` now removes `<outputDirectory>/output/factory/` after `_bundle()` finishes. For Software Factory projects the CLI build copies the ~4 MB Factory SPA into `<mastraDir>/public/factory/`, which `copyPublic()` then places under the deploy artifact. In Mastra Cloud that SPA is dead weight in the artifact because edge-router serves it from R2 upstream of the container — the origin never answers a request for it. Stripping it here (rather than in the CLI build) keeps other deploy targets (standalone docker, self-hosted, Vercel/Cloudflare/Netlify) serving the SPA themselves.
