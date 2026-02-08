---
"mastra": minor
---

Add support for worker threads in development mode by copying public files to output directory. The `mastra dev` command now copies files from `src/mastra/public/` to `.mastra/output/` on startup and watches for changes, bringing dev mode to parity with production builds. This enables Worker thread scripts and other static assets to be available at runtime during development.
