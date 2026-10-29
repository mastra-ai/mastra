---
'@mastra/deployer': patch
---

Fixed `mastra build` installing optional peer dependencies that your project does not use. When a package lazily imports an optional peer (declared in its `peerDependenciesMeta`) and that peer is not installed, the build output no longer lists it as `latest` in `.mastra/output/package.json`. For example, `@mastra/mcp` is only added to the output when your project installs it. Packages you list in `bundler.externals` are always kept.
