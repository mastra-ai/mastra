---
"@mastra/deployer": patch
"mastra": patch
---

Fix runtime TypeScript imports for transpilePackages during mastra dev

Added a Node.js ESM load hook that transpiles TypeScript files from transpilePackages on-the-fly using esbuild. Previously, transpilePackages only worked at build time but failed at runtime because Node.js tried to load raw .ts files directly.

Fixes #12617
