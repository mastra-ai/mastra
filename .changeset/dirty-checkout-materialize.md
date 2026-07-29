---
'@mastra/factory': patch
---

Opening a workspace no longer fails when the repository checkout holds uncommitted or untracked files that block `git pull` (for example residue from a changeset-version run or a build). Materialization now keeps the checkout as-is — the same treatment diverged session branches already receive — instead of surfacing "git pull failed: Your local changes would be overwritten by merge" and refusing to open the thread. Local state is never discarded to force the pull through.
