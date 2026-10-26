---
'@mastra/deployer': patch
---

The `Bundler` and `Deployer` base classes no longer depend on `@mastra/core` classes at build time. Existing deployers keep working unchanged, and `new Mastra({ deployer })` still type-checks with them.
