---
'@mastra/factory': patch
---

Session start no longer runs `git pull` on an existing checkout; it only clones when the repo is missing from the sandbox. Start-path phases (`workspace.onStart`, `workspace.setup-marker`, `workspace.setup`) now log their timings.
