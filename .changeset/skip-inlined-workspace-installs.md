---
'@mastra/deployer': patch
---

`mastra build` no longer installs workspace packages that it already compiled into the bundle. Previously every workspace package the app imported was packed into `.mastra/output/workspace-module`, added to the output `package.json`, and installed together with all of its dependencies, even though the bundle never loads it. Now only workspace packages kept external (for example through `bundler.externals`) are packed and installed, which makes the output smaller and the install faster. npm packages that inlined workspace code imports are still installed.

If a workspace package must stay installed at runtime (for example because it is loaded with `node --import`), add it to `bundler.externals`.
