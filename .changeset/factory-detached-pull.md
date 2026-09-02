---
'@mastra/factory': patch
---

Session start no longer runs `git pull` on a checkout that is already in the sandbox. A sandbox booted from a repo template image, or resumed after idling, has the repo on disk; materialize now leaves it as it is and only clones when no checkout of the repo exists. The pull cost a network round-trip on every start and, on a template image (detached at its pinned commit), had nothing to fast-forward. The session branch checkout that follows still fetches the base branch it needs. Start-path phases (`workspace.onStart`, `workspace.setup-marker`, `workspace.setup`) now log their timings alongside materialize and checkout.
