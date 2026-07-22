---
'create-factory': minor
---

Standardized the Vite SPA output directory to `src/mastra/public/factory/`. The template's `build` script delegates SPA building to `mastra build` (which calls `build:ui` automatically) instead of chaining it separately.
