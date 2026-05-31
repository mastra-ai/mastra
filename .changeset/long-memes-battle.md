---
'@mastra/deployer': patch
---

Added a belt-and-suspenders guardrail: when `@mastra/pg` appears in a user-supplied `bundler.externals` array, `@mastra/core/storage` is automatically added to the external list so the bundler never inlines the pg store's synchronous require of that subpath.
