---
'@mastra/factory': patch
---

Session start no longer runs `git pull` on a checkout with a detached HEAD, which is what a sandbox booted from a repo template image carries: the pull had nothing to fast-forward but still paid for its fetch. The session branch checkout that follows fetches the base branch itself. Start-path phases (`workspace.onStart`, `workspace.setup-marker`, `workspace.setup`) now log their timings alongside materialize and checkout.
