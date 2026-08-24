---
'@mastra/deployer': patch
---

Fixed a Mastra build that silently installed a dependency from the registry when the app declared it as a local link. A dependency declared with `link:`, `file:`, or a bare path that is not part of the workspace now fails the build with the package and specifier named, instead of resolving to whatever version the linked directory happens to declare — a version npm may never have published, and never the linked source either way.
