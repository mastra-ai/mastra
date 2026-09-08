---
'@mastra/factory': patch
---

Pull request review sessions now start on the PR head in seconds. The session branch comes from a blob-less fetch of the repository history, so `git log` and `git blame` work in the review while past file contents load on demand.
