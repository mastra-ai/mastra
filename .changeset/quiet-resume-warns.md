---
'@mastra/core': patch
---

Stopped internal agent-loop workflows from logging a `shouldPersistSnapshot excludes the "running" status` warning on every resume. Workflows can now set `options.allowUnclaimedResumes: true` to acknowledge that resume claims cannot be persisted (because `running` snapshots are intentionally not written) and suppress the per-resume warning; the built-in agentic-loop, agentic-execution, and agent-network workflows opt in. User workflows that exclude `running` without acknowledging still get the warning.
