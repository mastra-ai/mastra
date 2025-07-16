---
'@mastra/deployer': patch
---

Fix dependency resolving with directories

Follow import from `import x from 'pkg/dir'` => `import x from 'pkg/dir/index.js'` 
