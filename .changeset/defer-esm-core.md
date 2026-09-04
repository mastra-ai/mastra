---
'@mastra/core': patch
---

Fixed CommonJS entry points so `p-map` and `@sindresorhus/slugify` are bundled instead of being required as ESM-only runtime dependencies.
