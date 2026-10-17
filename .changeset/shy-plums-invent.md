---
'mastra': patch
'@mastra/factory': patch
---

`mastra deploy` now excludes `.mastra/output/factory/**` from the uploaded zip. The Factory SPA is served by the platform edge-router from R2 upstream of the container, so shipping the ~4 MB SPA in every deploy artifact is dead weight. The folder is left on disk so local `mastra start` continues to serve it. Other deploy targets (standalone docker, Vercel/Cloudflare/Netlify) are unaffected — they don't go through `mastra deploy`.

As a runtime safety net, `@mastra/factory`'s `resolveUiDistDir()` now also falls back to `node_modules/mastra/dist/factory/` (resolved via `createRequire`) when the SPA isn't found in the usual locations.
