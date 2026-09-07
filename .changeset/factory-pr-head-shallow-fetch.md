---
'@mastra/factory': patch
---

Pull request review sessions now start on the PR head in seconds. The session branch is created from a blob-less fetch of the repository history plus the PR head, so `git log` and `git blame` work in the review while past file contents load on demand, and the review board no longer asks the agent to run `gh pr checkout`, which downloaded the whole history into the shallow sandbox clone.
