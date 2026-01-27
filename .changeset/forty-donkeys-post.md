---
'@mastra/deployer': minor
---

Added support for preserving package manager overrides during mastra build. When your project uses pnpm.overrides, npm overrides, or yarn resolutions (e.g., for local development links), these are now correctly included in the generated .mastra/output/package.json with paths adjusted for the output directory.
