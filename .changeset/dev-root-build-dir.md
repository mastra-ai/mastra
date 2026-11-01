---
'@mastra/deployer': patch
'mastra': patch
---

Fixed `mastra dev --root <dir>` failing with `ENOENT ... .mastra/.build/entry-0.mjs` when the current directory has no `.mastra` folder. Dev pre-bundle output now goes to `<dir>/.mastra/.build` instead of the current working directory, so dev servers started with different `--root` values no longer overwrite each other's files.
