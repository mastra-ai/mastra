---
'@mastra/evals': patch
---

Add main entry point to @mastra/evals package. Packages with exports field should define a "." entry point. The package now exports commonly used utilities and prebuilt scorers from the main entry, allowing users to import directly from '@mastra/evals' in addition to the existing subpath exports.
