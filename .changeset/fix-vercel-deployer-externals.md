---
"@mastra/deployer-vercel": patch
---

fix(deployer-vercel): always force externals: true to prevent ESM TLA deadlocks

The Cloud deployer and CLI `mastra build` already force `externals: true` to avoid circular module evaluation deadlocks when dynamic imports produce code-split chunks. The Vercel deployer was missed when those fixes were added.
