---
'@mastra/platform-workspace': patch
'@mastra/e2b': patch
---

Fixed repo templates silently degrading to a repo-less template on hosts without a `git` binary (deployed Mastra servers), which made every session cold-clone at runtime. GitHub (github.com) clone URLs now resolve the default-branch head through the GitHub REST API; other hosts keep using `git ls-remote`.
