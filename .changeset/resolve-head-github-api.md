---
'@mastra/platform-workspace': patch
'@mastra/e2b': patch
---

Resolve a github.com repository's default-branch head through the GitHub REST API instead of `git ls-remote`, so repo templates build on hosts without a git binary (deployed Mastra servers). Non-GitHub clone URLs keep using `git ls-remote`.
