---
"mastra": minor
---

Copy `src/mastra/public/` files to `.mastra/output/` during `mastra dev`. The public directory is watched so changes are picked up on rebuild. This lets Worker thread scripts and other static assets work in development, matching the existing `mastra build` behavior.
