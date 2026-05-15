---
'@mastra/deployer': patch
---

Fixed bundler validation failing when a workspace package transitively imports a third-party dependency that was already listed in `bundler.externals`. The validation subprocess now stubs user-configured externals, matching the bundler's own treatment of them.
