---
'@mastra/deployer': patch
'mastra': patch
---

@mastra/deployer: patch
mastra: patch

Improved file persistence in dev mode. Files created by `mastra dev` are now saved in the public directory, so you can commit them to version control or ignore them via `.gitignore`.
