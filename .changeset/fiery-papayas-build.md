---
'@mastra/deployer-netlify': patch
---

Adjust the generated `.netlify/v1/config.json` file to not let Netlify bundle the functions (since Mastra already bundles its output). Also, re-enable ESM shimming.
