---
"@mastra/deployer": patch
---

Fix native dependencies in yarn monorepos

Resolve issue #7525 where @mastra/deployer attempted to call a non-existant flag on `yarn pack`.