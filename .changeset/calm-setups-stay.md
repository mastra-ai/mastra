---
'@mastra/factory': patch
---

Fixed sessions re-running a repository setup command that had already failed while the Factory environment was built. A session now starts right away and reports that repository's setup as failed, instead of running the same command again and holding the session up until it fails.
