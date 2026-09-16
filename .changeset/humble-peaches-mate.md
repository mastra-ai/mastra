---
'@mastra/deployer': patch
'mastra': patch
---

Fixed a bug where workspace packages listed in `bundler.externals` were still bundled into the build output. If you explicitly listed a workspace dependency as an external, it was converted to a `dynamicPackage` and compiled inline instead of remaining an external runtime dependency. Workspace packages in `bundler.externals` are now preserved as true externals.