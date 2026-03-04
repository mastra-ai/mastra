---
'@mastra/deployer': patch
---

Add execa to DEPS_TO_IGNORE and GLOBAL_EXTERNALS to prevent bundler crashes from unicorn-magic transitive dependency. Stub GLOBAL_EXTERNALS packages during validation to avoid Node.js resolution failures for externalized modules.
