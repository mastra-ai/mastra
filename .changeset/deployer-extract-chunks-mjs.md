---
'@mastra/deployer': patch
---

Fixed `mastra dev` failing to start under loaders like tsx when the server config uses a dynamic `import()`. The split chunks next to `server-config.mjs` are now written as `.mjs` instead of `.js`, so they load as ES modules whether or not the project's `package.json` sets `"type": "module"`.
